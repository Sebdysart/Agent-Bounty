/**
 * Tests for Neon PostgreSQL wrapper
 * Mocks the @neondatabase/serverless package to avoid real database calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the @neondatabase/serverless module before importing neonDb
vi.mock('@neondatabase/serverless', () => {
  const mockSql = vi.fn();
  const mockPool = {
    on: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  };

  return {
    neon: vi.fn(() => mockSql),
    neonConfig: {
      fetchConnectionCache: true,
    },
    Pool: vi.fn(() => mockPool),
  };
});

// Mock drizzle-orm
vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: vi.fn(() => ({})),
}));

// Mock schema
vi.mock('@shared/schema', () => ({}));

// Import after mocks are set up
import { NeonDbClient, NullNeonDbClient } from '../neonDb';
import { neon, Pool } from '@neondatabase/serverless';

describe('NeonDbClient', () => {
  let client: NeonDbClient;
  let mockSql: ReturnType<typeof vi.fn>;
  let mockPool: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mocks
    mockSql = vi.fn();
    mockPool = {
      on: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    };

    (neon as any).mockReturnValue(mockSql);
    (Pool as any).mockReturnValue(mockPool);

    // Create client with mock config
    client = new NeonDbClient({
      connectionString: 'postgresql://test:test@localhost:5432/test',
      maxConnections: 20,
      queryTimeoutMs: 30000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(client.isAvailable()).toBe(true);
    });

    it('should not initialize without connection string', () => {
      const originalEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unconfiguredClient = new NeonDbClient({ connectionString: '' });

      expect(unconfiguredClient.isAvailable()).toBe(false);
      consoleSpy.mockRestore();
      process.env.DATABASE_URL = originalEnv;
    });
  });

  describe('executeWithTimeout', () => {
    it('should execute query within timeout', async () => {
      const mockData = [{ id: 1 }];
      const queryFn = vi.fn().mockResolvedValue(mockData);

      const result = await client.executeWithTimeout(queryFn);

      expect(result.data).toEqual(mockData);
      expect(result.timedOut).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should timeout when query exceeds limit', async () => {
      // Create a slow query that takes longer than timeout
      const slowQueryFn = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      const result = await client.executeWithTimeout(slowQueryFn, 50);

      expect(result.timedOut).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should use default 30s timeout', async () => {
      const queryFn = vi.fn().mockResolvedValue([{ id: 1 }]);

      const result = await client.executeWithTimeout(queryFn);

      expect(result.timedOut).toBe(false);
      expect(queryFn).toHaveBeenCalled();
    });

    it('should allow custom timeout', async () => {
      const queryFn = vi.fn().mockResolvedValue([{ id: 1 }]);

      const result = await client.executeWithTimeout(queryFn, 5000);

      expect(result.timedOut).toBe(false);
    });

    it('should propagate non-timeout errors', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(client.executeWithTimeout(queryFn)).rejects.toThrow('Database error');
    });

    it('should measure duration correctly', async () => {
      const queryFn = vi.fn(() => new Promise(resolve => setTimeout(() => resolve([{ id: 1 }]), 20)));

      const result = await client.executeWithTimeout(queryFn, 1000);

      expect(result.durationMs).toBeGreaterThanOrEqual(15); // Allow some tolerance
      expect(result.timedOut).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockData = [{ id: 1 }];
      const queryFn = vi.fn().mockResolvedValue(mockData);

      const result = await client.executeWithRetry(queryFn);

      expect(result).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error', async () => {
      const mockData = [{ id: 1 }];
      const queryFn = vi.fn()
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValue(mockData);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await client.executeWithRetry(queryFn, 3);

      expect(result).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('should not retry on syntax error', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('syntax error at position 10'));

      await expect(client.executeWithRetry(queryFn)).rejects.toThrow('syntax error');
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on duplicate key error', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      await expect(client.executeWithRetry(queryFn)).rejects.toThrow('duplicate key');
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on permission denied error', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('permission denied for table users'));

      await expect(client.executeWithRetry(queryFn)).rejects.toThrow('permission denied');
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('Connection timeout'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(client.executeWithRetry(queryFn, 2)).rejects.toThrow('Connection timeout');
      expect(queryFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      consoleSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on successful query', async () => {
      mockSql.mockResolvedValue([{ '?column?': 1 }]);

      const result = await client.healthCheck();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status on query failure', async () => {
      mockSql.mockRejectedValue(new Error('Connection refused'));

      const result = await client.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('connect', () => {
    it('should verify connection on successful query', async () => {
      mockSql.mockResolvedValue([{ connected: 1 }]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await client.connect();

      expect(result).toBe(true);
      expect(client.isConnected()).toBe(true);
      consoleSpy.mockRestore();
    });

    it('should return false on connection failure', async () => {
      mockSql.mockRejectedValue(new Error('Connection failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.connect();

      expect(result).toBe(false);
      expect(client.isConnected()).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const stats = client.getPoolStats();

      expect(stats).toEqual({
        maxConnections: 20,
        connectionCacheEnabled: true,
        queryTimeoutMs: 30000,
        totalConnections: 5,
        idleConnections: 3,
        waitingClients: 0,
      });
    });
  });

  describe('close', () => {
    it('should close the connection pool', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await client.close();

      expect(mockPool.end).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getters', () => {
    it('getSql should return the sql function', () => {
      expect(client.getSql()).not.toBeNull();
    });

    it('getDb should return the drizzle instance', () => {
      expect(client.getDb()).not.toBeNull();
    });

    it('getPool should return the pool', () => {
      expect(client.getPool()).not.toBeNull();
    });

    it('getPooledDb should return the pooled drizzle instance', () => {
      expect(client.getPooledDb()).not.toBeNull();
    });
  });
});

describe('NullNeonDbClient', () => {
  let nullClient: NullNeonDbClient;

  beforeEach(() => {
    nullClient = new NullNeonDbClient();
  });

  it('getSql should return null', () => {
    expect(nullClient.getSql()).toBeNull();
  });

  it('getDb should return null', () => {
    expect(nullClient.getDb()).toBeNull();
  });

  it('getPool should return null', () => {
    expect(nullClient.getPool()).toBeNull();
  });

  it('getPooledDb should return null', () => {
    expect(nullClient.getPooledDb()).toBeNull();
  });

  it('isAvailable should return false', () => {
    expect(nullClient.isAvailable()).toBe(false);
  });

  it('isConnected should return false', () => {
    expect(nullClient.isConnected()).toBe(false);
  });

  it('connect should return false', async () => {
    expect(await nullClient.connect()).toBe(false);
  });

  it('executeWithRetry should throw error', async () => {
    await expect(nullClient.executeWithRetry(async () => 'test')).rejects.toThrow('Neon DB not available');
  });

  it('executeWithTimeout should return non-timed out result with null data', async () => {
    const result = await nullClient.executeWithTimeout(async () => 'test');
    expect(result.data).toBeNull();
    expect(result.durationMs).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it('healthCheck should return not configured status', async () => {
    const result = await nullClient.healthCheck();
    expect(result.connected).toBe(false);
    expect(result.error).toBe('Neon DB not configured');
  });

  it('query should throw error', async () => {
    await expect(nullClient.query('SELECT 1')).rejects.toThrow('Neon DB not available');
  });

  it('getPoolStats should return zero stats', () => {
    expect(nullClient.getPoolStats()).toEqual({
      maxConnections: 0,
      connectionCacheEnabled: false,
      queryTimeoutMs: 0,
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    });
  });

  it('close should resolve without error', async () => {
    await expect(nullClient.close()).resolves.toBeUndefined();
  });
});
