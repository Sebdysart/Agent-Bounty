import { Store } from "express-session";
import { upstashRedis } from "./upstashRedis";

interface SessionStoreOptions {
  prefix?: string;
  ttl?: number; // TTL in seconds
}

/**
 * Upstash Redis session store for express-session.
 * Serverless-friendly alternative to connect-pg-simple.
 */
export class UpstashSessionStore extends Store {
  private prefix: string;
  private ttl: number;

  constructor(options: SessionStoreOptions = {}) {
    super();
    this.prefix = options.prefix || "sess:";
    this.ttl = options.ttl || 7 * 24 * 60 * 60; // Default: 1 week in seconds
  }

  /**
   * Get a session by session ID
   */
  get(
    sid: string,
    callback: (err: any, session?: Express.SessionData | null) => void
  ): void {
    const key = this.prefix + sid;

    upstashRedis
      .getClient()
      ?.get<Express.SessionData>(key)
      .then((session) => {
        callback(null, session);
      })
      .catch((err) => {
        callback(err);
      });
  }

  /**
   * Set a session
   */
  set(
    sid: string,
    session: Express.SessionData,
    callback?: (err?: any) => void
  ): void {
    const key = this.prefix + sid;
    const ttl = this.getTTL(session);

    const client = upstashRedis.getClient();
    if (!client) {
      callback?.(new Error("Upstash Redis client not available"));
      return;
    }

    client
      .set(key, session, { ex: ttl })
      .then(() => {
        callback?.();
      })
      .catch((err) => {
        callback?.(err);
      });
  }

  /**
   * Destroy a session
   */
  destroy(sid: string, callback?: (err?: any) => void): void {
    const key = this.prefix + sid;

    upstashRedis
      .delete(key)
      .then(() => {
        callback?.();
      })
      .catch((err) => {
        callback?.(err);
      });
  }

  /**
   * Touch a session (refresh TTL without modifying data)
   */
  touch(
    sid: string,
    session: Express.SessionData,
    callback?: (err?: any) => void
  ): void {
    const key = this.prefix + sid;
    const ttl = this.getTTL(session);

    upstashRedis
      .expire(key, ttl)
      .then(() => {
        callback?.();
      })
      .catch((err) => {
        callback?.(err);
      });
  }

  /**
   * Get all sessions (for admin purposes)
   * Note: This uses SCAN which is safe for production
   */
  all(
    callback: (err: any, sessions?: { [sid: string]: Express.SessionData }) => void
  ): void {
    const client = upstashRedis.getClient();
    if (!client) {
      callback(null, {});
      return;
    }

    const sessions: { [sid: string]: Express.SessionData } = {};
    let cursor = 0;

    const scanNext = async () => {
      try {
        const [nextCursor, keys] = await client.scan(cursor, {
          match: `${this.prefix}*`,
          count: 100,
        });
        cursor = nextCursor;

        if (keys.length > 0) {
          const values = await client.mget<Express.SessionData[]>(...keys);
          keys.forEach((key, i) => {
            const sid = key.replace(this.prefix, "");
            if (values[i]) {
              sessions[sid] = values[i] as Express.SessionData;
            }
          });
        }

        if (cursor !== 0) {
          await scanNext();
        } else {
          callback(null, sessions);
        }
      } catch (err) {
        callback(err);
      }
    };

    scanNext();
  }

  /**
   * Get the number of active sessions
   */
  length(callback: (err: any, length?: number) => void): void {
    const client = upstashRedis.getClient();
    if (!client) {
      callback(null, 0);
      return;
    }

    let count = 0;
    let cursor = 0;

    const countNext = async () => {
      try {
        const [nextCursor, keys] = await client.scan(cursor, {
          match: `${this.prefix}*`,
          count: 100,
        });
        cursor = nextCursor;
        count += keys.length;

        if (cursor !== 0) {
          await countNext();
        } else {
          callback(null, count);
        }
      } catch (err) {
        callback(err);
      }
    };

    countNext();
  }

  /**
   * Clear all sessions
   */
  clear(callback?: (err?: any) => void): void {
    upstashRedis
      .deleteByPattern(`${this.prefix}*`)
      .then(() => {
        callback?.();
      })
      .catch((err) => {
        callback?.(err);
      });
  }

  /**
   * Calculate TTL for a session
   */
  private getTTL(session: Express.SessionData): number {
    if (session.cookie?.maxAge) {
      return Math.ceil(session.cookie.maxAge / 1000);
    }
    return this.ttl;
  }

  /**
   * Check if Upstash Redis is available for session storage
   */
  static isAvailable(): boolean {
    return upstashRedis.isAvailable();
  }
}

export default UpstashSessionStore;
