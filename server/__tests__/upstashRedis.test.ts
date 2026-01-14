/**
 * Tests for Upstash Redis client wrapper
 * Mocks the @upstash/redis package to avoid real API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpstashRedisClient } from '../upstashRedis';

// Mock the @upstash/redis module
vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {
      get = vi.fn();
      set = vi.fn();
      del = vi.fn();
      scan = vi.fn();
      mget = vi.fn();
      incr = vi.fn();
      expire = vi.fn();
      exists = vi.fn();
      ttl = vi.fn();
      ping = vi.fn();
      flushall = vi.fn();
      pipeline = vi.fn().mockReturnValue({
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn()
      });
    }
  };
});

describe('UpstashRedisClient', () => {
  let client: UpstashRedisClient;
  let mockRedis: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create client with mock config
    client = new UpstashRedisClient({
      url: 'https://mock-redis.upstash.io',
      token: 'mock-token'
    });

    // Get reference to the mocked Redis client
    mockRedis = (client as any).client;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when configured', () => {
      expect(client.isAvailable()).toBe(true);
    });

    it('should return false when not configured', () => {
      const unconfiguredClient = new UpstashRedisClient({});
      expect(unconfiguredClient.isAvailable()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return data from cache entry', async () => {
      const mockData = { name: 'test' };
      mockRedis.get.mockResolvedValue({ data: mockData, tags: [] });

      const result = await client.get('test-key');

      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await client.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.get('error-key');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should return null when client not configured', async () => {
      const unconfiguredClient = new UpstashRedisClient({});
      const result = await unconfiguredClient.get('any-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await client.set('test-key', { foo: 'bar' });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', { data: { foo: 'bar' }, tags: [] });
    });

    it('should set value with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await client.set('test-key', 'value', 300);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', { data: 'value', tags: [] }, { ex: 300 });
    });

    it('should set value with tags', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await client.set('test-key', 'value', undefined, ['tag1', 'tag2']);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', { data: 'value', tags: ['tag1', 'tag2'] });
    });

    it('should return false on error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Write failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.set('error-key', 'value');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false when client not configured', async () => {
      const unconfiguredClient = new UpstashRedisClient({});
      const result = await unconfiguredClient.set('any-key', 'value');
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await client.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should return false on error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Delete failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.delete('error-key');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('deleteByPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.scan.mockResolvedValueOnce([0, ['key1', 'key2']]);
      mockRedis.del.mockResolvedValue(2);

      const result = await client.deleteByPattern('prefix:*');

      expect(result).toBe(2);
      expect(mockRedis.scan).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should handle pagination in scan', async () => {
      mockRedis.scan
        .mockResolvedValueOnce([100, ['key1', 'key2']])
        .mockResolvedValueOnce([0, ['key3']]);
      mockRedis.del.mockResolvedValue(1);

      const result = await client.deleteByPattern('prefix:*');

      expect(result).toBe(3);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no keys match', async () => {
      mockRedis.scan.mockResolvedValue([0, []]);

      const result = await client.deleteByPattern('nonexistent:*');

      expect(result).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { cached: true };
      mockRedis.get.mockResolvedValue({ data: cachedData, tags: [] });
      const fetcher = vi.fn();

      const result = await client.getOrSet('test-key', fetcher);

      expect(result).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const freshData = { fresh: true };
      const fetcher = vi.fn().mockResolvedValue(freshData);

      const result = await client.getOrSet('test-key', fetcher, 300, ['tag1']);

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', { data: freshData, tags: ['tag1'] }, { ex: 300 });
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      mockRedis.mget.mockResolvedValue([
        { data: 'value1', tags: [] },
        null,
        { data: 'value3', tags: [] }
      ]);

      const result = await client.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual(['value1', null, 'value3']);
    });

    it('should return nulls for empty keys array', async () => {
      const result = await client.mget([]);
      expect(result).toEqual([]);
    });
  });

  describe('incr', () => {
    it('should increment counter', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await client.incr('counter-key');

      expect(result).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalledWith('counter-key');
    });

    it('should return 0 on error', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Incr failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.incr('error-key');

      expect(result).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('incrWithExpiry', () => {
    it('should increment and set expiry atomically', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([10, 1])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await client.incrWithExpiry('rate-limit-key', 60);

      expect(result).toBe(10);
      expect(mockPipeline.incr).toHaveBeenCalledWith('rate-limit-key');
      expect(mockPipeline.expire).toHaveBeenCalledWith('rate-limit-key', 60);
    });
  });

  describe('setNX', () => {
    it('should set value only if not exists', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await client.setNX('lock-key', 'locked', 30);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('lock-key', 'locked', { nx: true, ex: 30 });
    });

    it('should return false if key exists', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await client.setNX('existing-key', 'value');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await client.exists('existing-key');

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await client.exists('nonexistent-key');

      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    it('should set expiry on key', async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await client.expire('test-key', 300);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('test-key', 300);
    });
  });

  describe('ttl', () => {
    it('should return TTL of key', async () => {
      mockRedis.ttl.mockResolvedValue(120);

      const result = await client.ttl('test-key');

      expect(result).toBe(120);
    });

    it('should return -2 when client not configured', async () => {
      const unconfiguredClient = new UpstashRedisClient({});
      const result = await unconfiguredClient.ttl('any-key');
      expect(result).toBe(-2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on successful ping', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await client.healthCheck();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status on ping failure', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await client.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should return not configured status when client not available', async () => {
      const unconfiguredClient = new UpstashRedisClient({});

      const result = await unconfiguredClient.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Redis client not configured');
    });
  });

  describe('flushAll', () => {
    it('should flush all keys', async () => {
      mockRedis.flushall.mockResolvedValue('OK');

      const result = await client.flushAll();

      expect(result).toBe(true);
      expect(mockRedis.flushall).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockRedis.flushall.mockRejectedValue(new Error('Flush failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.flushAll();

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });
});
