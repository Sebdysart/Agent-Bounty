/**
 * Tests for the data caching layer (dataCache.ts)
 * Tests verify caching behavior with mocked Upstash Redis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataCache, DataCacheService } from '../dataCache';
import { upstashRedis } from '../upstashRedis';

// Mock the upstashRedis module
vi.mock('../upstashRedis', () => ({
  upstashRedis: {
    isAvailable: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    deleteByPattern: vi.fn(),
    getOrSet: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

describe('DataCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when Redis is available', () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      expect(dataCache.isAvailable()).toBe(true);
    });

    it('should return false when Redis is not available', () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(false);
      expect(dataCache.isAvailable()).toBe(false);
    });
  });

  describe('Bounty Caching', () => {
    it('should cache bounty list when Redis is available', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockBounties = [{ id: 1, title: 'Test Bounty' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockBounties);

      const fetcher = vi.fn().mockResolvedValue(mockBounties);
      const result = await dataCache.getBountyList(fetcher);

      expect(result).toEqual(mockBounties);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:bounties:list',
        fetcher,
        300,
        ['bounties']
      );
      expect(fetcher).not.toHaveBeenCalled(); // Fetcher passed to getOrSet, not called directly
    });

    it('should bypass cache and call fetcher when Redis is not available', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(false);
      const mockBounties = [{ id: 1, title: 'Test Bounty' }];
      const fetcher = vi.fn().mockResolvedValue(mockBounties);

      const result = await dataCache.getBountyList(fetcher);

      expect(result).toEqual(mockBounties);
      expect(fetcher).toHaveBeenCalled();
      expect(upstashRedis.getOrSet).not.toHaveBeenCalled();
    });

    it('should cache individual bounty by ID', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockBounty = { id: 123, title: 'Test Bounty' };
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockBounty);

      const fetcher = vi.fn().mockResolvedValue(mockBounty);
      const result = await dataCache.getBounty(123, fetcher);

      expect(result).toEqual(mockBounty);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:bounty:123',
        fetcher,
        600,
        ['bounty', 'bounty:123']
      );
    });

    it('should invalidate bounty caches correctly', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.delete).mockResolvedValue(true);

      await dataCache.invalidateBounty(123);

      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:bounties:list');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:bounty:123');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:stats');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:analytics');
    });
  });

  describe('Agent Caching', () => {
    it('should cache agent profile by ID', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockAgent = { id: 42, name: 'Test Agent' };
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockAgent);

      const fetcher = vi.fn().mockResolvedValue(mockAgent);
      const result = await dataCache.getAgent(42, fetcher);

      expect(result).toEqual(mockAgent);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:agent:42',
        fetcher,
        600,
        ['agent', 'agent:42']
      );
    });

    it('should cache top agents with limit', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockAgents = [{ id: 1, name: 'Top Agent' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockAgents);

      const fetcher = vi.fn().mockResolvedValue(mockAgents);
      const result = await dataCache.getTopAgents(10, fetcher);

      expect(result).toEqual(mockAgents);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:agents:top:10',
        fetcher,
        300,
        ['agents', 'leaderboard']
      );
    });

    it('should invalidate agent caches correctly', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.delete).mockResolvedValue(true);
      vi.mocked(upstashRedis.deleteByPattern).mockResolvedValue(5);

      await dataCache.invalidateAgent(42);

      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:agent:42');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:leaderboard');
      expect(upstashRedis.deleteByPattern).toHaveBeenCalledWith('cache:agents:top:*');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:stats');
    });
  });

  describe('Leaderboard Caching', () => {
    it('should cache leaderboard with 1 minute TTL', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockLeaderboard = [{ id: 1, name: 'Top Agent', earnings: '1000' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockLeaderboard);

      const fetcher = vi.fn().mockResolvedValue(mockLeaderboard);
      const result = await dataCache.getLeaderboard(fetcher);

      expect(result).toEqual(mockLeaderboard);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:leaderboard',
        fetcher,
        60, // 1 minute TTL as specified
        ['leaderboard']
      );
    });

    it('should invalidate leaderboard cache', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.delete).mockResolvedValue(true);

      await dataCache.invalidateLeaderboard();

      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:leaderboard');
    });
  });

  describe('Stats Caching', () => {
    it('should cache platform stats', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockStats = { totalBounties: 100, totalAgents: 50 };
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockStats);

      const fetcher = vi.fn().mockResolvedValue(mockStats);
      const result = await dataCache.getStats(fetcher);

      expect(result).toEqual(mockStats);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:stats',
        fetcher,
        120,
        ['stats']
      );
    });

    it('should invalidate stats cache', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.delete).mockResolvedValue(true);

      await dataCache.invalidateStats();

      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:stats');
    });
  });

  describe('Analytics Caching', () => {
    it('should cache analytics data', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockAnalytics = { bountyTrends: [], summary: {} };
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockAnalytics);

      const fetcher = vi.fn().mockResolvedValue(mockAnalytics);
      const result = await dataCache.getAnalytics(fetcher);

      expect(result).toEqual(mockAnalytics);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:analytics',
        fetcher,
        300,
        ['analytics']
      );
    });

    it('should cache advanced analytics with longer TTL', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockAdvanced = { metrics: [] };
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockAdvanced);

      const fetcher = vi.fn().mockResolvedValue(mockAdvanced);
      const result = await dataCache.getAdvancedAnalytics(fetcher);

      expect(result).toEqual(mockAdvanced);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:analytics:advanced',
        fetcher,
        600, // 10 minute TTL for expensive queries
        ['analytics']
      );
    });

    it('should cache ROI analytics', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockROI = { roi: 150, efficiency: 0.8 };
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockROI);

      const fetcher = vi.fn().mockResolvedValue(mockROI);
      const result = await dataCache.getROIAnalytics(fetcher);

      expect(result).toEqual(mockROI);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:analytics:roi',
        fetcher,
        600,
        ['analytics']
      );
    });

    it('should invalidate all analytics caches', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.delete).mockResolvedValue(true);

      await dataCache.invalidateAnalytics();

      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:analytics');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:analytics:advanced');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:analytics:performance');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:analytics:roi');
      expect(upstashRedis.delete).toHaveBeenCalledWith('cache:analytics:benchmarks');
    });
  });

  describe('Recent Activity Caching', () => {
    it('should cache recent activity with limit', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockActivity = [{ id: '1', type: 'bounty_created' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockActivity);

      const fetcher = vi.fn().mockResolvedValue(mockActivity);
      const result = await dataCache.getRecentActivity(20, fetcher);

      expect(result).toEqual(mockActivity);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:activity:recent:20',
        fetcher,
        60,
        ['activity']
      );
    });
  });

  describe('Agent Marketplace Caching', () => {
    it('should cache agent uploads without filters', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockUploads = [{ id: 1, name: 'Test Agent' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockUploads);

      const fetcher = vi.fn().mockResolvedValue(mockUploads);
      const result = await dataCache.getAgentUploads(undefined, fetcher);

      expect(result).toEqual(mockUploads);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:agent-uploads:list',
        fetcher,
        300,
        ['agent-uploads']
      );
    });

    it('should cache agent uploads with category filter', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockUploads = [{ id: 1, name: 'Marketing Agent' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockUploads);

      const fetcher = vi.fn().mockResolvedValue(mockUploads);
      const result = await dataCache.getAgentUploads({ category: 'marketing' }, fetcher);

      expect(result).toEqual(mockUploads);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:agent-uploads:list:marketing:',
        fetcher,
        300,
        ['agent-uploads']
      );
    });

    it('should cache featured agents', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      const mockFeatured = [{ id: 1, name: 'Featured Agent' }];
      vi.mocked(upstashRedis.getOrSet).mockResolvedValue(mockFeatured);

      const fetcher = vi.fn().mockResolvedValue(mockFeatured);
      const result = await dataCache.getFeaturedAgents(fetcher);

      expect(result).toEqual(mockFeatured);
      expect(upstashRedis.getOrSet).toHaveBeenCalledWith(
        'cache:agents:featured',
        fetcher,
        300,
        ['agents', 'featured']
      );
    });
  });

  describe('Bulk Invalidation', () => {
    it('should invalidate all caches', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.deleteByPattern).mockResolvedValue(100);

      await dataCache.invalidateAll();

      expect(upstashRedis.deleteByPattern).toHaveBeenCalledWith('cache:*');
    });

    it('should not throw when Redis is unavailable', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(false);

      await expect(dataCache.invalidateAll()).resolves.not.toThrow();
      expect(upstashRedis.deleteByPattern).not.toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when Redis is connected', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({
        connected: true,
        latencyMs: 5,
      });

      const health = await dataCache.healthCheck();

      expect(health.available).toBe(true);
      expect(health.latencyMs).toBe(5);
      expect(health.error).toBeUndefined();
    });

    it('should return unavailable when Redis is not configured', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(false);

      const health = await dataCache.healthCheck();

      expect(health.available).toBe(false);
      expect(health.error).toBe('Redis not configured');
    });

    it('should return error from Redis health check', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);
      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({
        connected: false,
        latencyMs: 100,
        error: 'Connection timeout',
      });

      const health = await dataCache.healthCheck();

      expect(health.available).toBe(false);
      expect(health.error).toBe('Connection timeout');
    });
  });

  describe('Graceful Degradation', () => {
    it('should always return data from fetcher when cache unavailable', async () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(false);

      const testData = { test: 'data' };
      const fetcher = vi.fn().mockResolvedValue(testData);

      // Test all cache methods gracefully degrade
      expect(await dataCache.getBountyList(fetcher)).toEqual(testData);
      expect(await dataCache.getBounty(1, fetcher)).toEqual(testData);
      expect(await dataCache.getAgent(1, fetcher)).toEqual(testData);
      expect(await dataCache.getTopAgents(10, fetcher)).toEqual(testData);
      expect(await dataCache.getLeaderboard(fetcher)).toEqual(testData);
      expect(await dataCache.getStats(fetcher)).toEqual(testData);
      expect(await dataCache.getAnalytics(fetcher)).toEqual(testData);

      // All should have called fetcher directly, not Redis
      expect(fetcher).toHaveBeenCalledTimes(7);
      expect(upstashRedis.getOrSet).not.toHaveBeenCalled();
    });
  });
});
