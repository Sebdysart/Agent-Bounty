import { neon, neonConfig, NeonQueryFunction, Pool } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import { cacheGet, cacheSet, cacheInvalidate, getRedisClient } from "./upstashRedis";

/**
 * Configuration for Neon serverless database connection.
 */
interface NeonDbConfig {
  connectionString?: string;
  /** Maximum connections in pool (default: 20) */
  maxConnections?: number;
  /** Query timeout in milliseconds (default: 30000) */
  queryTimeoutMs?: number;
  /** Enable connection caching for better performance (default: true) */
  enableConnectionCache?: boolean;
}

/**
 * Health check result for the Neon database.
 */
interface NeonHealthStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Query result with timing information.
 */
interface TimedQueryResult<T> {
  data: T;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Cache configuration for query caching.
 */
interface QueryCacheConfig {
  /** TTL in seconds for cached queries (default: 60) */
  ttlSeconds?: number;
  /** Tags for cache invalidation */
  tags?: string[];
  /** Skip cache read (force fresh query, but still update cache) */
  bypassRead?: boolean;
}

/**
 * Cached query result with metadata.
 */
interface CachedQueryResult<T> {
  data: T;
  fromCache: boolean;
  durationMs: number;
}

/**
 * Retry configuration for connection attempts.
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_CONFIG: Required<NeonDbConfig> = {
  connectionString: "",
  maxConnections: 20,
  queryTimeoutMs: 30000,
  enableConnectionCache: true,
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
};

/**
 * Neon PostgreSQL wrapper for serverless usage.
 *
 * Key features:
 * - Uses HTTP-based connections (no persistent TCP connections)
 * - Works in edge runtimes (Cloudflare Workers, Vercel Edge, etc.)
 * - Connection caching for improved performance
 * - Query timeout handling
 * - Exponential backoff retry logic
 * - Health check with latency measurement
 */
class NeonDbClient {
  private sql: NeonQueryFunction<false, false> | null = null;
  private drizzleDb: NeonHttpDatabase<typeof schema> | null = null;
  private pool: Pool | null = null;
  private poolDrizzleDb: NeonDatabase<typeof schema> | null = null;
  private config: Required<NeonDbConfig>;
  private retryConfig: RetryConfig;
  private isConfigured = false;
  private connectionVerified = false;

  constructor(config?: NeonDbConfig, retryConfig?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.initializeClient();
  }

  /**
   * Initialize the Neon client with HTTP and Pool configurations.
   */
  private initializeClient(): void {
    const connectionString = this.config.connectionString || process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn("Neon DB not configured - missing DATABASE_URL");
      return;
    }

    // Configure Neon for serverless usage
    neonConfig.fetchConnectionCache = this.config.enableConnectionCache;

    // Create the SQL query function (HTTP-based, for simple queries)
    this.sql = neon(connectionString);

    // Create the Drizzle instance for HTTP queries
    this.drizzleDb = drizzle(this.sql, { schema });

    // Create connection pool with max 20 connections (for WebSocket-based queries)
    this.pool = new Pool({
      connectionString,
      max: this.config.maxConnections, // Max 20 connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Create Drizzle instance for pooled connections
    this.poolDrizzleDb = drizzlePool(this.pool, { schema });

    // Handle pool errors
    this.pool.on("error", (err) => {
      console.error("Neon pool error:", err);
    });

    this.isConfigured = true;
  }

  /**
   * Get the raw SQL query function for custom queries.
   */
  getSql(): NeonQueryFunction<false, false> | null {
    return this.sql;
  }

  /**
   * Get the Drizzle ORM instance for type-safe queries (HTTP-based).
   */
  getDb(): NeonHttpDatabase<typeof schema> | null {
    return this.drizzleDb;
  }

  /**
   * Get the connection pool for WebSocket-based queries.
   */
  getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Get the pooled Drizzle ORM instance for type-safe queries (WebSocket-based).
   * Use this for transactional queries or when you need persistent connections.
   */
  getPooledDb(): NeonDatabase<typeof schema> | null {
    return this.poolDrizzleDb;
  }

  /**
   * Check if the client is configured.
   */
  isAvailable(): boolean {
    return this.isConfigured && this.sql !== null;
  }

  /**
   * Check if connection has been verified.
   */
  isConnected(): boolean {
    return this.connectionVerified;
  }

  /**
   * Verify the database connection.
   */
  async connect(): Promise<boolean> {
    if (!this.sql) {
      console.warn("Neon DB not configured - cannot connect");
      return false;
    }

    try {
      const result = await this.sql`SELECT 1 as connected`;
      this.connectionVerified = Array.isArray(result) && result.length > 0;
      if (this.connectionVerified) {
        console.log("Neon serverless database connection verified");
      }
      return this.connectionVerified;
    } catch (error) {
      console.error("Failed to connect to Neon database:", error);
      this.connectionVerified = false;
      return false;
    }
  }

  /**
   * Connect with exponential backoff retry logic.
   * Useful for initial connection attempts where the database may be cold-starting.
   */
  async connectWithRetry(retries: number = this.retryConfig.maxRetries): Promise<boolean> {
    if (!this.sql) {
      console.warn("Neon DB not configured - cannot connect");
      return false;
    }

    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.sql`SELECT 1 as connected`;
        this.connectionVerified = Array.isArray(result) && result.length > 0;
        if (this.connectionVerified) {
          console.log(`Neon serverless database connection verified (attempt ${attempt + 1})`);
          return true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (attempt < retries) {
          console.warn(
            `Neon connection failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms: ${errorMessage}`
          );
          await this.sleep(delay);
          delay = Math.min(delay * 2, this.retryConfig.maxDelayMs);
        } else {
          console.error(`Neon connection failed after ${retries + 1} attempts: ${errorMessage}`);
        }
      }
    }

    this.connectionVerified = false;
    return false;
  }

  /**
   * Execute a query with retry logic and exponential backoff.
   */
  async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    retries: number = this.retryConfig.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await queryFn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-retriable errors
        if (this.isNonRetriableError(error)) {
          throw error;
        }

        if (attempt < retries) {
          console.warn(
            `Neon query failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
            error instanceof Error ? error.message : error
          );
          await this.sleep(delay);
          delay = Math.min(delay * 2, this.retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError || new Error("Query failed after all retries");
  }

  /**
   * Check if an error is non-retriable (e.g., syntax errors, constraint violations).
   */
  private isNonRetriableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Don't retry syntax errors, constraint violations, or auth errors
      return (
        message.includes("syntax error") ||
        message.includes("duplicate key") ||
        message.includes("violates") ||
        message.includes("permission denied") ||
        message.includes("authentication failed")
      );
    }
    return false;
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute a query with timeout handling.
   */
  async executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeoutMs: number = this.config.queryTimeoutMs
  ): Promise<TimedQueryResult<T>> {
    const start = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const data = await Promise.race([queryFn(), timeoutPromise]);
      return {
        data,
        durationMs: Date.now() - start,
        timedOut: false,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("timed out")) {
        return {
          data: null as T,
          durationMs: Date.now() - start,
          timedOut: true,
        };
      }
      throw error;
    }
  }

  /**
   * Health check with latency measurement.
   */
  async healthCheck(): Promise<NeonHealthStatus> {
    if (!this.sql) {
      return {
        connected: false,
        latencyMs: 0,
        error: "Neon DB client not configured",
      };
    }

    const start = Date.now();
    try {
      await this.sql`SELECT 1`;
      return {
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute a raw SQL query using the Neon query function.
   */
  async query<T = Record<string, unknown>>(
    queryText: string,
    params?: unknown[]
  ): Promise<T[]> {
    if (!this.sql) {
      throw new Error("Neon DB client not configured");
    }

    return this.executeWithRetry(async () => {
      // Use tagged template literal for parameterized queries
      if (params && params.length > 0) {
        // Build a query with parameters
        const result = await this.sql!(queryText, params);
        return result as T[];
      }
      // For simple queries without parameters
      const result = await this.sql!`${queryText}`;
      return result as T[];
    });
  }

  /**
   * Get database connection pool stats (for monitoring).
   */
  getPoolStats(): {
    maxConnections: number;
    connectionCacheEnabled: boolean;
    queryTimeoutMs: number;
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  } {
    return {
      maxConnections: this.config.maxConnections,
      connectionCacheEnabled: this.config.enableConnectionCache,
      queryTimeoutMs: this.config.queryTimeoutMs,
      totalConnections: this.pool?.totalCount ?? 0,
      idleConnections: this.pool?.idleCount ?? 0,
      waitingClients: this.pool?.waitingCount ?? 0,
    };
  }

  // ============================================================================
  // Query Caching Integration with Upstash Redis
  // ============================================================================

  /**
   * Generate a cache key for a query.
   * Uses a hash of the query text and params for uniqueness.
   */
  private generateCacheKey(queryText: string, params?: unknown[]): string {
    const paramsStr = params ? JSON.stringify(params) : "";
    // Simple hash for cache key (not cryptographic, just for uniqueness)
    let hash = 0;
    const str = queryText + paramsStr;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `neon:query:${Math.abs(hash).toString(36)}`;
  }

  /**
   * Execute a cached query using Upstash Redis.
   * If cached, returns from cache. Otherwise executes query and caches result.
   *
   * @param queryText - SQL query text
   * @param params - Query parameters
   * @param cacheConfig - Cache configuration
   * @returns Query result with cache metadata
   */
  async cachedQuery<T = Record<string, unknown>>(
    queryText: string,
    params?: unknown[],
    cacheConfig: QueryCacheConfig = {}
  ): Promise<CachedQueryResult<T[]>> {
    if (!this.sql) {
      throw new Error("Neon DB client not configured");
    }

    const start = Date.now();
    const cacheKey = this.generateCacheKey(queryText, params);
    const { ttlSeconds = 60, tags = [], bypassRead = false } = cacheConfig;

    // Check if Redis caching is available
    const redisClient = getRedisClient();
    const useCache = redisClient.isAvailable();

    // Try to get from cache first (unless bypassing)
    if (useCache && !bypassRead) {
      const cached = await cacheGet<T[]>(cacheKey);
      if (cached !== null) {
        return {
          data: cached,
          fromCache: true,
          durationMs: Date.now() - start,
        };
      }
    }

    // Execute the query
    const data = await this.executeWithRetry(async () => {
      if (params && params.length > 0) {
        const result = await this.sql!(queryText, params);
        return result as T[];
      }
      const result = await this.sql!`${queryText}`;
      return result as T[];
    });

    // Cache the result if Redis is available
    if (useCache) {
      await cacheSet(cacheKey, data, ttlSeconds, tags);
    }

    return {
      data,
      fromCache: false,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Execute a query with caching using a fetcher function.
   * This is useful for Drizzle queries or other async query functions.
   *
   * @param cacheKey - Unique cache key for this query
   * @param fetcher - Async function that executes the query
   * @param cacheConfig - Cache configuration
   * @returns Query result with cache metadata
   */
  async cachedFetch<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    cacheConfig: QueryCacheConfig = {}
  ): Promise<CachedQueryResult<T>> {
    const start = Date.now();
    const prefixedKey = `neon:${cacheKey}`;
    const { ttlSeconds = 60, tags = [], bypassRead = false } = cacheConfig;

    // Check if Redis caching is available
    const redisClient = getRedisClient();
    const useCache = redisClient.isAvailable();

    // Try to get from cache first (unless bypassing)
    if (useCache && !bypassRead) {
      const cached = await cacheGet<T>(prefixedKey);
      if (cached !== null) {
        return {
          data: cached,
          fromCache: true,
          durationMs: Date.now() - start,
        };
      }
    }

    // Execute the query
    const data = await fetcher();

    // Cache the result if Redis is available
    if (useCache) {
      await cacheSet(prefixedKey, data, ttlSeconds, tags);
    }

    return {
      data,
      fromCache: false,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Invalidate cached queries by key, pattern, or tag.
   *
   * @param options - Invalidation options
   * @returns Number of cache entries invalidated
   */
  async invalidateCache(options: {
    key?: string;
    pattern?: string;
    tag?: string;
  }): Promise<number> {
    // Prefix the key/pattern with neon namespace
    const prefixedOptions: { key?: string; pattern?: string; tag?: string } = {};

    if (options.key) {
      prefixedOptions.key = `neon:${options.key}`;
    }
    if (options.pattern) {
      prefixedOptions.pattern = `neon:${options.pattern}`;
    }
    if (options.tag) {
      prefixedOptions.tag = options.tag;
    }

    return cacheInvalidate(prefixedOptions);
  }

  /**
   * Invalidate all cached queries.
   * Use with caution - this clears all Neon query cache entries.
   */
  async invalidateAllCache(): Promise<number> {
    return cacheInvalidate({ pattern: "neon:*" });
  }

  /**
   * Close the connection pool gracefully.
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log("Neon connection pool closed");
    }
  }
}

/**
 * Null implementation of NeonDbClient for when the database is not configured.
 */
class NullNeonDbClient {
  getSql(): null { return null; }
  getDb(): null { return null; }
  getPool(): null { return null; }
  getPooledDb(): null { return null; }
  isAvailable(): boolean { return false; }
  isConnected(): boolean { return false; }
  async connect(): Promise<boolean> { return false; }
  async connectWithRetry(): Promise<boolean> { return false; }
  async executeWithRetry<T>(): Promise<T> {
    throw new Error("Neon DB not available");
  }
  async executeWithTimeout<T>(): Promise<TimedQueryResult<T>> {
    return { data: null as T, durationMs: 0, timedOut: false };
  }
  async healthCheck(): Promise<NeonHealthStatus> {
    return { connected: false, latencyMs: 0, error: "Neon DB not configured" };
  }
  async query<T>(): Promise<T[]> {
    throw new Error("Neon DB not available");
  }
  getPoolStats() {
    return { maxConnections: 0, connectionCacheEnabled: false, queryTimeoutMs: 0, totalConnections: 0, idleConnections: 0, waitingClients: 0 };
  }
  async cachedQuery<T>(): Promise<CachedQueryResult<T[]>> {
    throw new Error("Neon DB not available");
  }
  async cachedFetch<T>(): Promise<CachedQueryResult<T>> {
    throw new Error("Neon DB not available");
  }
  async invalidateCache(): Promise<number> { return 0; }
  async invalidateAllCache(): Promise<number> { return 0; }
  async close(): Promise<void> {}
}

// Singleton instance
const neonDbInstance = new NeonDbClient();

/**
 * Get the Neon database client.
 * Returns the configured client or a null implementation if not available.
 */
export function getNeonClient(): NeonDbClient | NullNeonDbClient {
  if (neonDbInstance.isAvailable()) {
    return neonDbInstance;
  }
  return new NullNeonDbClient();
}

/**
 * Get the Drizzle ORM instance for type-safe queries.
 * This is a convenience function for direct database access.
 */
export function getNeonDb(): NeonHttpDatabase<typeof schema> | null {
  return neonDbInstance.getDb();
}

/**
 * Get the raw SQL query function for custom queries.
 */
export function getNeonSql(): NeonQueryFunction<false, false> | null {
  return neonDbInstance.getSql();
}

/**
 * Get the connection pool for WebSocket-based queries.
 */
export function getNeonPool(): Pool | null {
  return neonDbInstance.getPool();
}

/**
 * Get the pooled Drizzle ORM instance for type-safe queries.
 * Use this for transactional queries or when you need persistent connections.
 */
export function getNeonPooledDb(): NeonDatabase<typeof schema> | null {
  return neonDbInstance.getPooledDb();
}

// Export types and classes
export { NeonDbClient, NullNeonDbClient, Pool };
export type { NeonDbConfig, NeonHealthStatus, TimedQueryResult, RetryConfig, QueryCacheConfig, CachedQueryResult };

// Export the singleton instance
export const neonDb = neonDbInstance;
