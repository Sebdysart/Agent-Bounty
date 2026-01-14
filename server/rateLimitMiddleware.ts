import { Request, Response, NextFunction } from "express";
import { sendRateLimitExceeded } from "./errorResponse";
import { upstashRedis } from "./upstashRedis";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory fallback store for rate limiting (used when Redis unavailable or in tests)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute (for in-memory fallback)
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  });
}, 60 * 1000);

/**
 * Check rate limit using Upstash Redis.
 * Returns the current count and reset time, or null if Redis is unavailable.
 */
async function checkRateLimitRedis(
  key: string,
  windowMs: number
): Promise<{ count: number; resetTime: number } | null> {
  if (!upstashRedis.isAvailable()) {
    return null;
  }

  const redisKey = `ratelimit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    const client = upstashRedis.getClient();
    if (!client) return null;

    // Use a pipeline for atomic operations
    const pipeline = client.pipeline();
    pipeline.incr(redisKey);
    pipeline.ttl(redisKey);
    const results = await pipeline.exec();

    const count = results[0] as number;
    let ttl = results[1] as number;

    // If key is new (ttl is -1, meaning no expiry set), set the expiry
    if (ttl === -1) {
      await client.expire(redisKey, windowSeconds);
      ttl = windowSeconds;
    }

    // Calculate reset time from TTL
    const resetTime = Date.now() + (ttl * 1000);

    return { count, resetTime };
  } catch (error) {
    console.error(`Rate limit Redis error for key ${key}:`, error);
    return null;
  }
}

/**
 * Check rate limit using in-memory store (fallback).
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number
): { count: number; resetTime: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, entry);
  } else {
    entry.count++;
  }

  return { count: entry.count, resetTime: entry.resetTime };
}

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, message = "Too many requests, please try again later" } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.claims?.sub ||
                   (req as any).tokenPayload?.userId ||
                   req.ip ||
                   'anonymous';

    const key = `${userId}:${req.path}`;
    const now = Date.now();

    // Try Redis first, fall back to in-memory
    let result = await checkRateLimitRedis(key, windowMs);
    if (!result) {
      result = checkRateLimitMemory(key, windowMs);
    }

    const { count, resetTime } = result;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (count > maxRequests) {
      return sendRateLimitExceeded(res, message, Math.ceil((resetTime - now) / 1000));
    }

    next();
  };
}

// Preset rate limiters
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: "API rate limit exceeded. Please wait before making more requests."
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: "Too many authentication attempts. Please try again later."
});

export const credentialRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: "Too many credential access attempts. Please wait."
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  message: "AI execution rate limit exceeded. Please wait."
});

export const stripeRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: "Too many payment requests. Please wait."
});
