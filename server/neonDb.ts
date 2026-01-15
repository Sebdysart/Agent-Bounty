import { neon, neonConfig, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

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
   * Initialize the Neon client with HTTP configuration.
   */
  private initializeClient(): void {
    const connectionString = this.config.connectionString || process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn("Neon DB not configured - missing DATABASE_URL");
      return;
    }

    // Configure Neon for serverless usage
    neonConfig.fetchConnectionCache = this.config.enableConnectionCache;

    // Create the SQL query function
    this.sql = neon(connectionString);

    // Create the Drizzle instance
    this.drizzleDb = drizzle(this.sql, { schema });

    this.isConfigured = true;
  }

  /**
   * Get the raw SQL query function for custom queries.
   */
  getSql(): NeonQueryFunction<false, false> | null {
    return this.sql;
  }

  /**
   * Get the Drizzle ORM instance for type-safe queries.
   */
  getDb(): NeonHttpDatabase<typeof schema> | null {
    return this.drizzleDb;
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
   * Note: Neon serverless uses HTTP, so these are simulated metrics.
   */
  getPoolStats(): {
    maxConnections: number;
    connectionCacheEnabled: boolean;
    queryTimeoutMs: number;
  } {
    return {
      maxConnections: this.config.maxConnections,
      connectionCacheEnabled: this.config.enableConnectionCache,
      queryTimeoutMs: this.config.queryTimeoutMs,
    };
  }
}

/**
 * Null implementation of NeonDbClient for when the database is not configured.
 */
class NullNeonDbClient {
  getSql(): null { return null; }
  getDb(): null { return null; }
  isAvailable(): boolean { return false; }
  isConnected(): boolean { return false; }
  async connect(): Promise<boolean> { return false; }
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
    return { maxConnections: 0, connectionCacheEnabled: false, queryTimeoutMs: 0 };
  }
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

// Export types and classes
export { NeonDbClient, NullNeonDbClient };
export type { NeonDbConfig, NeonHealthStatus, TimedQueryResult, RetryConfig };

// Export the singleton instance
export const neonDb = neonDbInstance;
