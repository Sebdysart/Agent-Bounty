import { db } from "./db";
import { agents, bounties } from "@shared/schema";
import { sql } from "drizzle-orm";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  tags: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  memoryUsage: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, memoryUsage: 0 };
  private defaultTTL = 300000;
  private maxSize = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlMs?: number, tags: string[] = []): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.defaultTTL),
      tags
    });
    this.stats.size = this.cache.size;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlMs?: number, 
    tags: string[] = []
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, ttlMs, tags);
    return data;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(entries: { key: string; data: T; ttlMs?: number; tags?: string[] }[]): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.data, entry.ttlMs, entry.tags || []);
    }
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0, memoryUsage: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
    this.stats.size = this.cache.size;
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt < oldestTime) {
        oldest = key;
        oldestTime = entry.expiresAt;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  private estimateMemoryUsage(): number {
    let size = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      size += key.length * 2;
      size += JSON.stringify(entry.data).length * 2;
    }
    return size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  async getLeaderboard(limit: number = 10): Promise<any[]> {
    const cacheKey = `leaderboard:${limit}`;
    
    return this.getOrSet(
      cacheKey,
      async () => {
        const result = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          totalEarnings: agents.totalEarnings,
          avgRating: agents.avgRating
        })
        .from(agents)
        .orderBy(sql`${agents.totalEarnings} DESC, ${agents.avgRating} DESC`)
        .limit(limit);
        
        return result;
      },
      60000,
      ['leaderboard', 'agents']
    );
  }

  async getPlatformStats(): Promise<{
    totalBounties: number;
    totalAgents: number;
    totalPaidOut: string;
    averageCompletionTime: number;
  }> {
    const cacheKey = 'platform:stats';
    
    return this.getOrSet(
      cacheKey,
      async () => {
        const [bountyCount] = await db.select({ count: sql<number>`count(*)` }).from(bounties);
        const [agentCount] = await db.select({ count: sql<number>`count(*)` }).from(agents);
        const [totalPaid] = await db.select({ 
          total: sql<string>`COALESCE(SUM(reward), 0)` 
        }).from(bounties).where(sql`status = 'completed'`);
        
        return {
          totalBounties: bountyCount?.count || 0,
          totalAgents: agentCount?.count || 0,
          totalPaidOut: totalPaid?.total || '0',
          averageCompletionTime: 72
        };
      },
      120000,
      ['stats', 'platform']
    );
  }

  async getCategoryStats(): Promise<{ category: string; count: number; avgReward: string }[]> {
    const cacheKey = 'stats:categories';
    
    return this.getOrSet(
      cacheKey,
      async () => {
        const result = await db.select({
          category: bounties.category,
          count: sql<number>`count(*)`,
          avgReward: sql<string>`ROUND(AVG(reward::numeric), 2)`
        })
        .from(bounties)
        .groupBy(bounties.category);
        
        return result;
      },
      300000,
      ['stats', 'categories']
    );
  }

  async invalidateLeaderboard(): Promise<void> {
    await this.invalidateByTag('leaderboard');
  }

  async invalidateStats(): Promise<void> {
    await this.invalidateByTag('stats');
  }

  async invalidateAgent(agentId: number): Promise<void> {
    await this.invalidateByPattern(`agent:${agentId}:*`);
    await this.invalidateByTag('leaderboard');
  }

  async invalidateBounty(bountyId: number): Promise<void> {
    await this.invalidateByPattern(`bounty:${bountyId}:*`);
    await this.invalidateByTag('stats');
  }
}

export const cacheService = new CacheService();
