import { Redis } from "@upstash/redis";
import { featureFlags } from "./featureFlags";

interface UpstashRedisConfig {
  url?: string;
  token?: string;
}

interface CacheEntry<T> {
  data: T;
  tags: string[];
}

interface RedisHealthStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Interface matching existing Redis usage patterns in the codebase.
 * This interface abstracts the Redis operations used by:
 * - rateLimitMiddleware.ts (incr, expire, ttl, pipeline)
 * - dataCache.ts (get, set, delete, deleteByPattern, getOrSet)
 * - upstashSessionStore.ts (get, set, delete, expire, scan, mget)
 */
export interface IRedisClient {
  // Connection management
  connect(): Promise<boolean>;
  isConnected(): boolean;
  isAvailable(): boolean;
  getClient(): Redis | null;

  // Basic operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttlSeconds?: number, tags?: string[]): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  deleteByPattern(pattern: string): Promise<number>;

  // Cache utilities
  getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
    tags?: string[]
  ): Promise<T>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;

  // Rate limiting operations
  incr(key: string): Promise<number>;
  incrWithExpiry(key: string, ttlSeconds: number): Promise<number>;

  // Key management
  setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;

  // Health & maintenance
  healthCheck(): Promise<RedisHealthStatus>;
  flushAll(): Promise<boolean>;
}

/**
 * Upstash Redis client wrapper for serverless-friendly caching.
 * Uses REST API which is compatible with edge runtimes and serverless functions.
 *
 * Key features for serverless:
 * - No persistent TCP connections (uses HTTP/REST)
 * - Stateless - each request is independent
 * - No connection pooling required
 * - Works in edge runtimes (Cloudflare Workers, Vercel Edge, etc.)
 */
class UpstashRedisClient implements IRedisClient {
  private client: Redis | null = null;
  private isConfigured = false;
  private connectionVerified = false;
  private config: UpstashRedisConfig | undefined;

  constructor(config?: UpstashRedisConfig) {
    this.config = config;
    this.initializeClient();
  }

  /**
   * Initialize the Redis client with REST API configuration
   */
  private initializeClient(): void {
    const url = this.config?.url || process.env.UPSTASH_REDIS_REST_URL;
    const token = this.config?.token || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      // Upstash Redis uses REST API by default - no TCP connection needed
      // This makes it ideal for serverless/edge environments
      this.client = new Redis({
        url,
        token,
        // Automatic retry with exponential backoff for transient failures
        retry: {
          retries: 3,
          backoff: (retryCount) => Math.min(Math.exp(retryCount) * 50, 1000)
        }
      });
      this.isConfigured = true;
    }
  }

  /**
   * Connect to Upstash Redis and verify the connection.
   * For serverless, this is optional since each request is stateless,
   * but useful for startup validation.
   */
  async connect(): Promise<boolean> {
    if (!this.client) {
      console.warn('Upstash Redis not configured - missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
      return false;
    }

    try {
      const result = await this.client.ping();
      this.connectionVerified = result === 'PONG';
      if (this.connectionVerified) {
        console.log('Upstash Redis connection verified via REST API');
      }
      return this.connectionVerified;
    } catch (error) {
      console.error('Failed to connect to Upstash Redis:', error);
      this.connectionVerified = false;
      return false;
    }
  }

  /**
   * Check if connection has been verified
   */
  isConnected(): boolean {
    return this.connectionVerified;
  }

  /**
   * Check if Upstash Redis is configured and available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Get the underlying Redis client (for advanced operations)
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const entry = await this.client.get<CacheEntry<T>>(key);
      return entry?.data ?? null;
    } catch (error) {
      console.error(`Upstash Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(
    key: string,
    data: T,
    ttlSeconds?: number,
    tags: string[] = []
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      const entry: CacheEntry<T> = { data, tags };

      if (ttlSeconds) {
        await this.client.set(key, entry, { ex: ttlSeconds });
      } else {
        await this.client.set(key, entry);
      }
      return true;
    } catch (error) {
      console.error(`Upstash Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Upstash Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * Note: Uses SCAN for production safety (no KEYS command)
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      let cursor = 0;
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, {
          match: pattern,
          count: 100
        });
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== 0);

      return deletedCount;
    } catch (error) {
      console.error(`Upstash Redis pattern delete error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and store
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
    tags: string[] = []
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, ttlSeconds, tags);
    return data;
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const entries = await this.client.mget<(CacheEntry<T> | null)[]>(...keys);
      return entries.map(entry => entry?.data ?? null);
    } catch (error) {
      console.error(`Upstash Redis MGET error:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Increment a counter (useful for rate limiting)
   */
  async incr(key: string): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error(`Upstash Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Increment and set expiry atomically (for rate limiting windows)
   */
  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    if (!this.client) return 0;

    try {
      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);
      const results = await pipeline.exec();
      return (results[0] as number) || 0;
    } catch (error) {
      console.error(`Upstash Redis INCR+EXPIRE error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set a key with NX (only if not exists) - useful for locks
   */
  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const options: { nx: true; ex?: number } = { nx: true };
      if (ttlSeconds) {
        options.ex = ttlSeconds;
      }
      const result = await this.client.set(key, value, options);
      return result === "OK";
    } catch (error) {
      console.error(`Upstash Redis SETNX error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Upstash Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiry on an existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error(`Upstash Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL of a key in seconds
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Upstash Redis TTL error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Health check - ping Redis and measure latency
   */
  async healthCheck(): Promise<RedisHealthStatus> {
    if (!this.client) {
      return {
        connected: false,
        latencyMs: 0,
        error: "Redis client not configured"
      };
    }

    const start = Date.now();
    try {
      await this.client.ping();
      return {
        connected: true,
        latencyMs: Date.now() - start
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Flush all keys (use with caution!)
   */
  async flushAll(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.flushall();
      return true;
    } catch (error) {
      console.error(`Upstash Redis FLUSHALL error:`, error);
      return false;
    }
  }
}

/**
 * Null implementation of IRedisClient that returns safe defaults.
 * Used when USE_UPSTASH_REDIS feature flag is disabled.
 */
class NullRedisClient implements IRedisClient {
  async connect(): Promise<boolean> { return false; }
  isConnected(): boolean { return false; }
  isAvailable(): boolean { return false; }
  getClient(): Redis | null { return null; }
  async get<T>(_key: string): Promise<T | null> { return null; }
  async set<T>(_key: string, _data: T, _ttlSeconds?: number, _tags?: string[]): Promise<boolean> { return false; }
  async delete(_key: string): Promise<boolean> { return false; }
  async deleteByPattern(_pattern: string): Promise<number> { return 0; }
  async getOrSet<T>(_key: string, fetcher: () => Promise<T>, _ttlSeconds?: number, _tags?: string[]): Promise<T> {
    return fetcher();
  }
  async mget<T>(keys: string[]): Promise<(T | null)[]> { return keys.map(() => null); }
  async incr(_key: string): Promise<number> { return 0; }
  async incrWithExpiry(_key: string, _ttlSeconds: number): Promise<number> { return 0; }
  async setNX(_key: string, _value: string, _ttlSeconds?: number): Promise<boolean> { return false; }
  async exists(_key: string): Promise<boolean> { return false; }
  async expire(_key: string, _ttlSeconds: number): Promise<boolean> { return false; }
  async ttl(_key: string): Promise<number> { return -2; }
  async healthCheck(): Promise<RedisHealthStatus> {
    return { connected: false, latencyMs: 0, error: "USE_UPSTASH_REDIS feature flag is disabled" };
  }
  async flushAll(): Promise<boolean> { return false; }
}

// Internal singleton instances
const upstashRedisInstance = new UpstashRedisClient();
const nullRedisInstance = new NullRedisClient();

/**
 * Get the Redis client based on the USE_UPSTASH_REDIS feature flag.
 * Returns the real Upstash client when enabled, or a null implementation when disabled.
 */
export function getRedisClient(userId?: string): IRedisClient {
  if (featureFlags.isEnabled("USE_UPSTASH_REDIS", userId)) {
    return upstashRedisInstance;
  }
  return nullRedisInstance;
}

// Singleton instance for the application (checks feature flag on each operation)
export const upstashRedis: IRedisClient = new Proxy({} as IRedisClient, {
  get(_target, prop: keyof IRedisClient) {
    const client = getRedisClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Export class for testing/custom instances
export { UpstashRedisClient, NullRedisClient };
export type { UpstashRedisConfig, RedisHealthStatus, IRedisClient };
