/**
 * Data caching layer using Upstash Redis for frequently accessed data.
 * Provides caching with configurable TTLs and automatic cache invalidation.
 */

import { upstashRedis } from "./upstashRedis";

// Cache key prefixes for different data types
const CACHE_KEYS = {
  BOUNTY_LIST: "cache:bounties:list",
  BOUNTY: "cache:bounty:",
  AGENT_PROFILE: "cache:agent:",
  AGENT_LIST: "cache:agents:list",
  TOP_AGENTS: "cache:agents:top:",
  LEADERBOARD: "cache:leaderboard",
  STATS: "cache:stats",
  ANALYTICS: "cache:analytics",
  ANALYTICS_ADVANCED: "cache:analytics:advanced",
  ANALYTICS_PERFORMANCE: "cache:analytics:performance",
  ANALYTICS_ROI: "cache:analytics:roi",
  ANALYTICS_BENCHMARKS: "cache:analytics:benchmarks",
  RECENT_ACTIVITY: "cache:activity:recent:",
  AGENT_UPLOADS: "cache:agent-uploads:list",
  FEATURED_AGENTS: "cache:agents:featured",
} as const;

// TTL values in seconds (as specified in RALPH_TASK.md)
const TTL = {
  BOUNTY_LIST: 300,       // 5 min - Bounty listings
  BOUNTY: 600,            // 10 min - Individual bounty
  AGENT_PROFILE: 600,     // 10 min - Agent profiles
  TOP_AGENTS: 300,        // 5 min - Top agents list
  LEADERBOARD: 60,        // 1 min - Leaderboard (frequent updates)
  STATS: 120,             // 2 min - Platform stats
  ANALYTICS: 300,         // 5 min - Analytics data
  ANALYTICS_ADVANCED: 600, // 10 min - Advanced analytics (expensive queries)
  RECENT_ACTIVITY: 60,    // 1 min - Recent activity feed
  AGENT_UPLOADS: 300,     // 5 min - Agent marketplace
  FEATURED_AGENTS: 300,   // 5 min - Featured agents
} as const;

/**
 * Data cache service wrapping Upstash Redis for frequently accessed data
 */
class DataCacheService {
  /**
   * Check if caching is available
   */
  isAvailable(): boolean {
    return upstashRedis.isAvailable();
  }

  // ============================================
  // BOUNTY CACHING
  // ============================================

  /**
   * Get cached bounty list or fetch from database
   */
  async getBountyList<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.BOUNTY_LIST,
      fetcher,
      TTL.BOUNTY_LIST,
      ["bounties"]
    );
  }

  /**
   * Get cached individual bounty or fetch from database
   */
  async getBounty<T>(id: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      `${CACHE_KEYS.BOUNTY}${id}`,
      fetcher,
      TTL.BOUNTY,
      ["bounty", `bounty:${id}`]
    );
  }

  /**
   * Invalidate bounty-related caches
   */
  async invalidateBounty(id?: number): Promise<void> {
    if (!this.isAvailable()) return;

    // Always invalidate the list
    await upstashRedis.delete(CACHE_KEYS.BOUNTY_LIST);

    // Invalidate specific bounty if ID provided
    if (id !== undefined) {
      await upstashRedis.delete(`${CACHE_KEYS.BOUNTY}${id}`);
    }

    // Invalidate related caches
    await upstashRedis.delete(CACHE_KEYS.STATS);
    await upstashRedis.delete(CACHE_KEYS.ANALYTICS);
    await upstashRedis.delete(CACHE_KEYS.RECENT_ACTIVITY + "*");
  }

  // ============================================
  // AGENT CACHING
  // ============================================

  /**
   * Get cached agent profile or fetch from database
   */
  async getAgent<T>(id: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      `${CACHE_KEYS.AGENT_PROFILE}${id}`,
      fetcher,
      TTL.AGENT_PROFILE,
      ["agent", `agent:${id}`]
    );
  }

  /**
   * Get cached top agents list or fetch from database
   */
  async getTopAgents<T>(limit: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      `${CACHE_KEYS.TOP_AGENTS}${limit}`,
      fetcher,
      TTL.TOP_AGENTS,
      ["agents", "leaderboard"]
    );
  }

  /**
   * Invalidate agent-related caches
   */
  async invalidateAgent(id?: number): Promise<void> {
    if (!this.isAvailable()) return;

    if (id !== undefined) {
      await upstashRedis.delete(`${CACHE_KEYS.AGENT_PROFILE}${id}`);
    }

    // Invalidate related aggregate caches
    await upstashRedis.delete(CACHE_KEYS.LEADERBOARD);
    await upstashRedis.deleteByPattern(`${CACHE_KEYS.TOP_AGENTS}*`);
    await upstashRedis.delete(CACHE_KEYS.STATS);
    await upstashRedis.delete(CACHE_KEYS.FEATURED_AGENTS);
  }

  // ============================================
  // LEADERBOARD CACHING
  // ============================================

  /**
   * Get cached leaderboard or fetch from database
   */
  async getLeaderboard<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.LEADERBOARD,
      fetcher,
      TTL.LEADERBOARD,
      ["leaderboard"]
    );
  }

  /**
   * Invalidate leaderboard cache
   */
  async invalidateLeaderboard(): Promise<void> {
    if (!this.isAvailable()) return;
    await upstashRedis.delete(CACHE_KEYS.LEADERBOARD);
  }

  // ============================================
  // PLATFORM STATS CACHING
  // ============================================

  /**
   * Get cached platform stats or fetch from database
   */
  async getStats<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.STATS,
      fetcher,
      TTL.STATS,
      ["stats"]
    );
  }

  /**
   * Invalidate stats cache
   */
  async invalidateStats(): Promise<void> {
    if (!this.isAvailable()) return;
    await upstashRedis.delete(CACHE_KEYS.STATS);
  }

  // ============================================
  // ANALYTICS CACHING
  // ============================================

  /**
   * Get cached analytics or fetch from database
   */
  async getAnalytics<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.ANALYTICS,
      fetcher,
      TTL.ANALYTICS,
      ["analytics"]
    );
  }

  /**
   * Get cached advanced analytics or fetch from database
   */
  async getAdvancedAnalytics<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.ANALYTICS_ADVANCED,
      fetcher,
      TTL.ANALYTICS_ADVANCED,
      ["analytics"]
    );
  }

  /**
   * Get cached agent performance analytics or fetch from database
   */
  async getAgentPerformanceAnalytics<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.ANALYTICS_PERFORMANCE,
      fetcher,
      TTL.ANALYTICS_ADVANCED,
      ["analytics"]
    );
  }

  /**
   * Get cached ROI analytics or fetch from database
   */
  async getROIAnalytics<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.ANALYTICS_ROI,
      fetcher,
      TTL.ANALYTICS_ADVANCED,
      ["analytics"]
    );
  }

  /**
   * Get cached benchmark analytics or fetch from database
   */
  async getBenchmarkAnalytics<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.ANALYTICS_BENCHMARKS,
      fetcher,
      TTL.ANALYTICS_ADVANCED,
      ["analytics"]
    );
  }

  /**
   * Invalidate all analytics caches
   */
  async invalidateAnalytics(): Promise<void> {
    if (!this.isAvailable()) return;
    await upstashRedis.delete(CACHE_KEYS.ANALYTICS);
    await upstashRedis.delete(CACHE_KEYS.ANALYTICS_ADVANCED);
    await upstashRedis.delete(CACHE_KEYS.ANALYTICS_PERFORMANCE);
    await upstashRedis.delete(CACHE_KEYS.ANALYTICS_ROI);
    await upstashRedis.delete(CACHE_KEYS.ANALYTICS_BENCHMARKS);
  }

  // ============================================
  // RECENT ACTIVITY CACHING
  // ============================================

  /**
   * Get cached recent activity or fetch from database
   */
  async getRecentActivity<T>(limit: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      `${CACHE_KEYS.RECENT_ACTIVITY}${limit}`,
      fetcher,
      TTL.RECENT_ACTIVITY,
      ["activity"]
    );
  }

  /**
   * Invalidate recent activity cache
   */
  async invalidateRecentActivity(): Promise<void> {
    if (!this.isAvailable()) return;
    await upstashRedis.deleteByPattern(`${CACHE_KEYS.RECENT_ACTIVITY}*`);
  }

  // ============================================
  // AGENT MARKETPLACE CACHING
  // ============================================

  /**
   * Get cached agent uploads/marketplace listings or fetch from database
   */
  async getAgentUploads<T>(
    filters: { category?: string; search?: string } | undefined,
    fetcher: () => Promise<T>
  ): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    const cacheKey = filters
      ? `${CACHE_KEYS.AGENT_UPLOADS}:${filters.category || "all"}:${filters.search || ""}`
      : CACHE_KEYS.AGENT_UPLOADS;
    return upstashRedis.getOrSet(
      cacheKey,
      fetcher,
      TTL.AGENT_UPLOADS,
      ["agent-uploads"]
    );
  }

  /**
   * Get cached featured agents or fetch from database
   */
  async getFeaturedAgents<T>(fetcher: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      return fetcher();
    }
    return upstashRedis.getOrSet(
      CACHE_KEYS.FEATURED_AGENTS,
      fetcher,
      TTL.FEATURED_AGENTS,
      ["agents", "featured"]
    );
  }

  /**
   * Invalidate agent uploads/marketplace caches
   */
  async invalidateAgentUploads(): Promise<void> {
    if (!this.isAvailable()) return;
    await upstashRedis.deleteByPattern(`${CACHE_KEYS.AGENT_UPLOADS}*`);
    await upstashRedis.delete(CACHE_KEYS.FEATURED_AGENTS);
  }

  // ============================================
  // BULK INVALIDATION
  // ============================================

  /**
   * Invalidate all caches (use sparingly)
   */
  async invalidateAll(): Promise<void> {
    if (!this.isAvailable()) return;
    await upstashRedis.deleteByPattern("cache:*");
  }

  /**
   * Get cache health status
   */
  async healthCheck(): Promise<{
    available: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return { available: false, error: "Redis not configured" };
    }
    const health = await upstashRedis.healthCheck();
    return {
      available: health.connected,
      latencyMs: health.latencyMs,
      error: health.error,
    };
  }
}

// Singleton instance
export const dataCache = new DataCacheService();

// Export class for testing
export { DataCacheService };
