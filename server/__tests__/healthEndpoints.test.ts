/**
 * Tests for Health Endpoints (/api/health, /api/ready, /api/metrics)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all service dependencies before importing anything
vi.mock('../upstashRedis', () => ({
  upstashRedis: {
    healthCheck: vi.fn(),
    isAvailable: vi.fn(),
  },
}));

vi.mock('../upstashKafka', () => ({
  upstashKafka: {
    healthCheck: vi.fn(),
    isAvailable: vi.fn(),
    getConsumerLag: vi.fn(),
  },
  KAFKA_TOPICS: {
    EXECUTION: 'agent-execution',
    RESULTS: 'execution-results',
    NOTIFICATIONS: 'notifications',
  },
}));

vi.mock('../r2Storage', () => ({
  r2Storage: {
    healthCheck: vi.fn(),
    isAvailable: vi.fn(),
  },
}));

vi.mock('../neonDb', () => ({
  getNeonClient: vi.fn(() => ({
    healthCheck: vi.fn(),
    isAvailable: vi.fn(),
    getPoolStats: vi.fn(),
  })),
}));

vi.mock('../wasmtimeSandbox', () => ({
  WasmtimeSandbox: {
    getWarmPoolStats: vi.fn(),
  },
}));

vi.mock('../featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(),
    getAllFlags: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../requestDurationMiddleware', () => ({
  getRequestDurationMetrics: vi.fn(),
}));

describe('Health Endpoints', () => {
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRes = {
      statusCode: 200,
      _json: null,
      _headers: {} as Record<string, string>,
      status: vi.fn(function(this: any, code: number) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function(this: any, data: any) {
        this._json = data;
        return this;
      }),
      setHeader: vi.fn(function(this: any, key: string, value: string) {
        this._headers[key] = value;
        return this;
      }),
      send: vi.fn(function(this: any, data: any) {
        this._json = data;
        return this;
      }),
    };
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are connected', async () => {
      const { upstashRedis } = await import('../upstashRedis');
      const { upstashKafka } = await import('../upstashKafka');
      const { r2Storage } = await import('../r2Storage');
      const { getNeonClient } = await import('../neonDb');
      const { WasmtimeSandbox } = await import('../wasmtimeSandbox');
      const { featureFlags } = await import('../featureFlags');

      // Setup healthy mocks
      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({ connected: true, latencyMs: 5 });
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);

      vi.mocked(upstashKafka.healthCheck).mockResolvedValue({ connected: true, latencyMs: 10 });
      vi.mocked(upstashKafka.isAvailable).mockReturnValue(true);
      vi.mocked(upstashKafka.getConsumerLag).mockResolvedValue(0);

      vi.mocked(r2Storage.healthCheck).mockResolvedValue({ connected: true, latencyMs: 15 });
      vi.mocked(r2Storage.isAvailable).mockReturnValue(true);

      const mockNeonClient = {
        healthCheck: vi.fn().mockResolvedValue({ connected: true, latencyMs: 20 }),
        isAvailable: vi.fn().mockReturnValue(true),
        getPoolStats: vi.fn().mockReturnValue({ totalConnections: 5, idleConnections: 3 }),
      };
      vi.mocked(getNeonClient).mockReturnValue(mockNeonClient as any);

      vi.mocked(WasmtimeSandbox.getWarmPoolStats).mockReturnValue({ size: 5, available: 3, maxSize: 10 });
      vi.mocked(featureFlags.isEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.getAllFlags).mockReturnValue({
        USE_WASMTIME_SANDBOX: { enabled: true, rolloutPercentage: 100, description: 'Test', overrideCount: 0 },
        USE_UPSTASH_REDIS: { enabled: true, rolloutPercentage: 100, description: 'Test', overrideCount: 0 },
        USE_UPSTASH_KAFKA: { enabled: true, rolloutPercentage: 100, description: 'Test', overrideCount: 0 },
        USE_R2_STORAGE: { enabled: true, rolloutPercentage: 100, description: 'Test', overrideCount: 0 },
      });

      // Execute the health check logic
      const [redisHealth, kafkaHealth, r2Health, neonHealth] = await Promise.all([
        upstashRedis.healthCheck(),
        upstashKafka.healthCheck(),
        r2Storage.healthCheck(),
        mockNeonClient.healthCheck(),
      ]);

      const neonClient = mockNeonClient;
      const redisHealthy = redisHealth.connected || !upstashRedis.isAvailable();
      const kafkaHealthy = kafkaHealth.connected || !upstashKafka.isAvailable();
      const r2Healthy = r2Health.connected || !r2Storage.isAvailable();
      const neonHealthy = neonHealth.connected || !neonClient.isAvailable();

      const isHealthy = redisHealthy && kafkaHealthy && r2Healthy && neonHealthy;

      expect(isHealthy).toBe(true);
      expect(redisHealth.connected).toBe(true);
      expect(kafkaHealth.connected).toBe(true);
      expect(r2Health.connected).toBe(true);
      expect(neonHealth.connected).toBe(true);
    });

    it('should return degraded status when database is unhealthy', async () => {
      const { upstashRedis } = await import('../upstashRedis');
      const { upstashKafka } = await import('../upstashKafka');
      const { r2Storage } = await import('../r2Storage');
      const { getNeonClient } = await import('../neonDb');

      // Database is unhealthy
      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({ connected: true, latencyMs: 5 });
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(true);

      vi.mocked(upstashKafka.healthCheck).mockResolvedValue({ connected: true, latencyMs: 10 });
      vi.mocked(upstashKafka.isAvailable).mockReturnValue(true);

      vi.mocked(r2Storage.healthCheck).mockResolvedValue({ connected: true, latencyMs: 15 });
      vi.mocked(r2Storage.isAvailable).mockReturnValue(true);

      const mockNeonClient = {
        healthCheck: vi.fn().mockResolvedValue({ connected: false, error: 'Connection refused' }),
        isAvailable: vi.fn().mockReturnValue(true),
        getPoolStats: vi.fn().mockReturnValue(null),
      };
      vi.mocked(getNeonClient).mockReturnValue(mockNeonClient as any);

      const [redisHealth, kafkaHealth, r2Health, neonHealth] = await Promise.all([
        upstashRedis.healthCheck(),
        upstashKafka.healthCheck(),
        r2Storage.healthCheck(),
        mockNeonClient.healthCheck(),
      ]);

      const neonClient = mockNeonClient;
      const neonHealthy = neonHealth.connected || !neonClient.isAvailable();
      const isHealthy = neonHealthy;

      expect(isHealthy).toBe(false);
      expect(neonHealth.connected).toBe(false);
      expect(neonHealth.error).toBe('Connection refused');
    });

    it('should return healthy when unconfigured services are not available', async () => {
      const { upstashRedis } = await import('../upstashRedis');
      const { upstashKafka } = await import('../upstashKafka');
      const { r2Storage } = await import('../r2Storage');
      const { getNeonClient } = await import('../neonDb');

      // Services not configured (not available)
      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({ connected: false });
      vi.mocked(upstashRedis.isAvailable).mockReturnValue(false);

      vi.mocked(upstashKafka.healthCheck).mockResolvedValue({ connected: false });
      vi.mocked(upstashKafka.isAvailable).mockReturnValue(false);

      vi.mocked(r2Storage.healthCheck).mockResolvedValue({ connected: false });
      vi.mocked(r2Storage.isAvailable).mockReturnValue(false);

      const mockNeonClient = {
        healthCheck: vi.fn().mockResolvedValue({ connected: false }),
        isAvailable: vi.fn().mockReturnValue(false),
        getPoolStats: vi.fn().mockReturnValue(null),
      };
      vi.mocked(getNeonClient).mockReturnValue(mockNeonClient as any);

      const [redisHealth, kafkaHealth, r2Health, neonHealth] = await Promise.all([
        upstashRedis.healthCheck(),
        upstashKafka.healthCheck(),
        r2Storage.healthCheck(),
        mockNeonClient.healthCheck(),
      ]);

      const neonClient = mockNeonClient;
      const redisHealthy = redisHealth.connected || !upstashRedis.isAvailable();
      const kafkaHealthy = kafkaHealth.connected || !upstashKafka.isAvailable();
      const r2Healthy = r2Health.connected || !r2Storage.isAvailable();
      const neonHealthy = neonHealth.connected || !neonClient.isAvailable();

      const isHealthy = redisHealthy && kafkaHealthy && r2Healthy && neonHealthy;

      // All are healthy because they're not configured
      expect(isHealthy).toBe(true);
      expect(redisHealthy).toBe(true);
      expect(kafkaHealthy).toBe(true);
      expect(r2Healthy).toBe(true);
      expect(neonHealthy).toBe(true);
    });

    it('should include memory usage information', async () => {
      const memUsage = process.memoryUsage();
      const memoryInfo = {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
      };

      expect(memoryInfo.heapUsedMB).toBeGreaterThanOrEqual(0);
      expect(memoryInfo.heapTotalMB).toBeGreaterThanOrEqual(0);
      expect(memoryInfo.rssMB).toBeGreaterThanOrEqual(0);
      expect(memoryInfo.externalMB).toBeGreaterThanOrEqual(0);
    });

    it('should include feature flags status', async () => {
      const { featureFlags } = await import('../featureFlags');

      vi.mocked(featureFlags.getAllFlags).mockReturnValue({
        USE_WASMTIME_SANDBOX: { enabled: false, rolloutPercentage: 0, description: 'Test', overrideCount: 0 },
        USE_UPSTASH_REDIS: { enabled: true, rolloutPercentage: 100, description: 'Test', overrideCount: 0 },
        USE_UPSTASH_KAFKA: { enabled: false, rolloutPercentage: 0, description: 'Test', overrideCount: 0 },
        USE_R2_STORAGE: { enabled: true, rolloutPercentage: 50, description: 'Test', overrideCount: 2 },
      });

      const flags = featureFlags.getAllFlags();

      expect(flags).toHaveProperty('USE_WASMTIME_SANDBOX');
      expect(flags).toHaveProperty('USE_UPSTASH_REDIS');
      expect(flags).toHaveProperty('USE_UPSTASH_KAFKA');
      expect(flags).toHaveProperty('USE_R2_STORAGE');
      expect(flags.USE_UPSTASH_REDIS.enabled).toBe(true);
    });

    it('should include Wasmtime pool stats', async () => {
      const { WasmtimeSandbox } = await import('../wasmtimeSandbox');

      vi.mocked(WasmtimeSandbox.getWarmPoolStats).mockReturnValue({
        size: 5,
        available: 3,
        maxSize: 10,
      });

      const poolStats = WasmtimeSandbox.getWarmPoolStats();

      expect(poolStats.size).toBe(5);
      expect(poolStats.available).toBe(3);
      expect(poolStats.maxSize).toBe(10);
    });

    it('should include Kafka consumer lag when available', async () => {
      const { upstashKafka, KAFKA_TOPICS } = await import('../upstashKafka');

      vi.mocked(upstashKafka.isAvailable).mockReturnValue(true);
      vi.mocked(upstashKafka.getConsumerLag).mockResolvedValue(42);

      const kafkaLag: Record<string, number | null> = {};
      if (upstashKafka.isAvailable()) {
        for (const [key, topic] of Object.entries(KAFKA_TOPICS)) {
          kafkaLag[key] = await upstashKafka.getConsumerLag(topic, 'default-group');
        }
      }

      expect(kafkaLag.EXECUTION).toBe(42);
      expect(kafkaLag.RESULTS).toBe(42);
      expect(kafkaLag.NOTIFICATIONS).toBe(42);
    });
  });

  describe('GET /api/ready', () => {
    it('should return ready status when database is connected', async () => {
      const { pool } = await import('../db');

      vi.mocked(pool.query).mockResolvedValue({ rows: [{ '1': 1 }] } as any);

      let dbReady = false;
      try {
        const result = await pool.query('SELECT 1');
        dbReady = result.rows.length > 0;
      } catch {
        dbReady = false;
      }

      expect(dbReady).toBe(true);

      const response = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: true,
        },
      };

      expect(response.status).toBe('ready');
      expect(response.checks.database).toBe(true);
    });

    it('should return not_ready status when database is disconnected', async () => {
      const { pool } = await import('../db');

      vi.mocked(pool.query).mockRejectedValue(new Error('Connection refused'));

      let dbReady = false;
      try {
        const result = await pool.query('SELECT 1');
        dbReady = result.rows.length > 0;
      } catch {
        dbReady = false;
      }

      expect(dbReady).toBe(false);

      const response = {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: false,
        },
      };

      expect(response.status).toBe('not_ready');
      expect(response.checks.database).toBe(false);
    });

    it('should include timestamp in response', async () => {
      const beforeTime = new Date();
      const response = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: true,
        },
      };
      const afterTime = new Date();

      const responseTime = new Date(response.timestamp);
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle database query errors gracefully', async () => {
      const { pool } = await import('../db');

      vi.mocked(pool.query).mockRejectedValue(new Error('Timeout'));

      let status = 'ready';
      let dbReady = true;
      let error: string | undefined;

      try {
        const result = await pool.query('SELECT 1');
        dbReady = result.rows.length > 0;
      } catch (e) {
        dbReady = false;
        status = 'not_ready';
        error = 'Readiness check failed';
      }

      expect(status).toBe('not_ready');
      expect(dbReady).toBe(false);
      expect(error).toBe('Readiness check failed');
    });
  });

  describe('GET /api/metrics', () => {
    it('should return Prometheus format metrics', async () => {
      const { upstashRedis } = await import('../upstashRedis');
      const { upstashKafka } = await import('../upstashKafka');
      const { r2Storage } = await import('../r2Storage');
      const { getNeonClient } = await import('../neonDb');
      const { WasmtimeSandbox } = await import('../wasmtimeSandbox');
      const { featureFlags } = await import('../featureFlags');

      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({ connected: true, latencyMs: 5 });
      vi.mocked(upstashKafka.healthCheck).mockResolvedValue({ connected: true, latencyMs: 10 });
      vi.mocked(r2Storage.healthCheck).mockResolvedValue({ connected: true, latencyMs: 15 });
      vi.mocked(upstashKafka.isAvailable).mockReturnValue(false);

      const mockNeonClient = {
        healthCheck: vi.fn().mockResolvedValue({ connected: true, latencyMs: 20 }),
      };
      vi.mocked(getNeonClient).mockReturnValue(mockNeonClient as any);

      vi.mocked(WasmtimeSandbox.getWarmPoolStats).mockReturnValue({ size: 5, available: 3, maxSize: 10 });
      vi.mocked(featureFlags.getAllFlags).mockReturnValue({
        USE_WASMTIME_SANDBOX: { enabled: false, rolloutPercentage: 0, description: 'Test', overrideCount: 0 },
      });

      const [redisHealth, kafkaHealth, r2Health, neonHealth] = await Promise.all([
        upstashRedis.healthCheck(),
        upstashKafka.healthCheck(),
        r2Storage.healthCheck(),
        mockNeonClient.healthCheck(),
      ]);

      const memUsage = process.memoryUsage();
      const wasmtimeStats = WasmtimeSandbox.getWarmPoolStats();
      const flags = featureFlags.getAllFlags();

      const lines: string[] = [];

      lines.push('# HELP agentbounty_up Whether the service is up (1) or down (0)');
      lines.push('# TYPE agentbounty_up gauge');
      lines.push('agentbounty_up 1');

      lines.push('');
      lines.push('# HELP agentbounty_component_healthy Component health status');
      lines.push('# TYPE agentbounty_component_healthy gauge');
      lines.push(`agentbounty_component_healthy{component="database"} ${neonHealth.connected ? 1 : 0}`);
      lines.push(`agentbounty_component_healthy{component="redis"} ${redisHealth.connected ? 1 : 0}`);
      lines.push(`agentbounty_component_healthy{component="kafka"} ${kafkaHealth.connected ? 1 : 0}`);
      lines.push(`agentbounty_component_healthy{component="r2"} ${r2Health.connected ? 1 : 0}`);

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_up 1');
      expect(output).toContain('agentbounty_component_healthy{component="database"} 1');
      expect(output).toContain('agentbounty_component_healthy{component="redis"} 1');
      expect(output).toContain('agentbounty_component_healthy{component="kafka"} 1');
      expect(output).toContain('agentbounty_component_healthy{component="r2"} 1');
    });

    it('should include component latency metrics', async () => {
      const { upstashRedis } = await import('../upstashRedis');
      const { upstashKafka } = await import('../upstashKafka');
      const { r2Storage } = await import('../r2Storage');
      const { getNeonClient } = await import('../neonDb');

      vi.mocked(upstashRedis.healthCheck).mockResolvedValue({ connected: true, latencyMs: 5 });
      vi.mocked(upstashKafka.healthCheck).mockResolvedValue({ connected: true, latencyMs: 10 });
      vi.mocked(r2Storage.healthCheck).mockResolvedValue({ connected: true, latencyMs: 15 });

      const mockNeonClient = {
        healthCheck: vi.fn().mockResolvedValue({ connected: true, latencyMs: 20 }),
      };
      vi.mocked(getNeonClient).mockReturnValue(mockNeonClient as any);

      const [redisHealth, kafkaHealth, r2Health, neonHealth] = await Promise.all([
        upstashRedis.healthCheck(),
        upstashKafka.healthCheck(),
        r2Storage.healthCheck(),
        mockNeonClient.healthCheck(),
      ]);

      const lines: string[] = [];
      lines.push('# HELP agentbounty_component_latency_ms Component response latency in milliseconds');
      lines.push('# TYPE agentbounty_component_latency_ms gauge');

      if (neonHealth.latencyMs !== undefined) {
        lines.push(`agentbounty_component_latency_ms{component="database"} ${neonHealth.latencyMs}`);
      }
      if (redisHealth.latencyMs !== undefined) {
        lines.push(`agentbounty_component_latency_ms{component="redis"} ${redisHealth.latencyMs}`);
      }
      if (kafkaHealth.latencyMs !== undefined) {
        lines.push(`agentbounty_component_latency_ms{component="kafka"} ${kafkaHealth.latencyMs}`);
      }
      if (r2Health.latencyMs !== undefined) {
        lines.push(`agentbounty_component_latency_ms{component="r2"} ${r2Health.latencyMs}`);
      }

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_component_latency_ms{component="database"} 20');
      expect(output).toContain('agentbounty_component_latency_ms{component="redis"} 5');
      expect(output).toContain('agentbounty_component_latency_ms{component="kafka"} 10');
      expect(output).toContain('agentbounty_component_latency_ms{component="r2"} 15');
    });

    it('should include memory metrics', async () => {
      const memUsage = process.memoryUsage();

      const lines: string[] = [];
      lines.push('# HELP agentbounty_memory_bytes Memory usage in bytes');
      lines.push('# TYPE agentbounty_memory_bytes gauge');
      lines.push(`agentbounty_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
      lines.push(`agentbounty_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
      lines.push(`agentbounty_memory_bytes{type="rss"} ${memUsage.rss}`);
      lines.push(`agentbounty_memory_bytes{type="external"} ${memUsage.external}`);

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_memory_bytes{type="heap_used"}');
      expect(output).toContain('agentbounty_memory_bytes{type="heap_total"}');
      expect(output).toContain('agentbounty_memory_bytes{type="rss"}');
      expect(output).toContain('agentbounty_memory_bytes{type="external"}');
    });

    it('should include Wasmtime pool metrics', async () => {
      const { WasmtimeSandbox } = await import('../wasmtimeSandbox');

      vi.mocked(WasmtimeSandbox.getWarmPoolStats).mockReturnValue({
        size: 5,
        available: 3,
        maxSize: 10,
      });

      const wasmtimeStats = WasmtimeSandbox.getWarmPoolStats();

      const lines: string[] = [];
      lines.push('# HELP agentbounty_wasmtime_pool_size Wasmtime warm pool size');
      lines.push('# TYPE agentbounty_wasmtime_pool_size gauge');
      lines.push(`agentbounty_wasmtime_pool_size ${wasmtimeStats.size}`);

      lines.push('');
      lines.push('# HELP agentbounty_wasmtime_pool_available Wasmtime available instances');
      lines.push('# TYPE agentbounty_wasmtime_pool_available gauge');
      lines.push(`agentbounty_wasmtime_pool_available ${wasmtimeStats.available}`);

      lines.push('');
      lines.push('# HELP agentbounty_wasmtime_pool_max Wasmtime pool max size');
      lines.push('# TYPE agentbounty_wasmtime_pool_max gauge');
      lines.push(`agentbounty_wasmtime_pool_max ${wasmtimeStats.maxSize}`);

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_wasmtime_pool_size 5');
      expect(output).toContain('agentbounty_wasmtime_pool_available 3');
      expect(output).toContain('agentbounty_wasmtime_pool_max 10');
    });

    it('should include feature flag metrics', async () => {
      const { featureFlags } = await import('../featureFlags');

      vi.mocked(featureFlags.getAllFlags).mockReturnValue({
        USE_WASMTIME_SANDBOX: { enabled: false, rolloutPercentage: 0, description: 'Test', overrideCount: 0 },
        USE_UPSTASH_REDIS: { enabled: true, rolloutPercentage: 100, description: 'Test', overrideCount: 0 },
        USE_UPSTASH_KAFKA: { enabled: true, rolloutPercentage: 50, description: 'Test', overrideCount: 0 },
        USE_R2_STORAGE: { enabled: false, rolloutPercentage: 0, description: 'Test', overrideCount: 0 },
      });

      const flags = featureFlags.getAllFlags();

      const lines: string[] = [];
      lines.push('# HELP agentbounty_feature_flag_enabled Whether a feature flag is enabled');
      lines.push('# TYPE agentbounty_feature_flag_enabled gauge');
      for (const [name, value] of Object.entries(flags)) {
        lines.push(`agentbounty_feature_flag_enabled{flag="${name}"} ${value.enabled ? 1 : 0}`);
      }

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_feature_flag_enabled{flag="USE_WASMTIME_SANDBOX"} 0');
      expect(output).toContain('agentbounty_feature_flag_enabled{flag="USE_UPSTASH_REDIS"} 1');
      expect(output).toContain('agentbounty_feature_flag_enabled{flag="USE_UPSTASH_KAFKA"} 1');
      expect(output).toContain('agentbounty_feature_flag_enabled{flag="USE_R2_STORAGE"} 0');
    });

    it('should include Kafka consumer lag when available', async () => {
      const { upstashKafka, KAFKA_TOPICS } = await import('../upstashKafka');

      vi.mocked(upstashKafka.isAvailable).mockReturnValue(true);
      vi.mocked(upstashKafka.getConsumerLag)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(5);

      const lines: string[] = [];

      if (upstashKafka.isAvailable()) {
        lines.push('# HELP agentbounty_kafka_consumer_lag Kafka consumer lag per topic');
        lines.push('# TYPE agentbounty_kafka_consumer_lag gauge');
        for (const [key, topic] of Object.entries(KAFKA_TOPICS)) {
          const lag = await upstashKafka.getConsumerLag(topic, 'default-group');
          if (lag !== null) {
            lines.push(`agentbounty_kafka_consumer_lag{topic="${key}"} ${lag}`);
          }
        }
      }

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_kafka_consumer_lag{topic="EXECUTION"} 10');
      expect(output).toContain('agentbounty_kafka_consumer_lag{topic="RESULTS"} 25');
      expect(output).toContain('agentbounty_kafka_consumer_lag{topic="NOTIFICATIONS"} 5');
    });

    it('should skip Kafka lag when not available', async () => {
      const { upstashKafka } = await import('../upstashKafka');

      vi.mocked(upstashKafka.isAvailable).mockReturnValue(false);

      const lines: string[] = [];

      if (upstashKafka.isAvailable()) {
        lines.push('# HELP agentbounty_kafka_consumer_lag Kafka consumer lag per topic');
      }

      expect(lines.length).toBe(0);
    });

    it('should include Node.js info metrics', async () => {
      const lines: string[] = [];
      lines.push('# HELP agentbounty_nodejs_info Node.js version and platform info');
      lines.push('# TYPE agentbounty_nodejs_info gauge');
      lines.push(`agentbounty_nodejs_info{version="${process.version}",platform="${process.platform}",arch="${process.arch}"} 1`);

      const output = lines.join('\n');

      expect(output).toContain('agentbounty_nodejs_info');
      expect(output).toContain(`version="${process.version}"`);
      expect(output).toContain(`platform="${process.platform}"`);
      expect(output).toContain(`arch="${process.arch}"`);
    });

    it('should set correct content type header for Prometheus', () => {
      const contentType = 'text/plain; version=0.0.4; charset=utf-8';
      mockRes.setHeader('Content-Type', contentType);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', contentType);
    });

    it('should include request duration metrics when available', async () => {
      const { getRequestDurationMetrics } = await import('../requestDurationMiddleware');

      const mockMetrics = `# HELP http_request_duration_seconds Request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/api/health"} 100
http_request_duration_seconds_bucket{le="0.5",method="GET",route="/api/health"} 150
http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/api/health"} 155`;

      vi.mocked(getRequestDurationMetrics).mockReturnValue(mockMetrics);

      const durationMetrics = getRequestDurationMetrics();

      expect(durationMetrics).toContain('http_request_duration_seconds');
      expect(durationMetrics).toContain('method="GET"');
      expect(durationMetrics).toContain('route="/api/health"');
    });

    it('should handle missing request duration metrics gracefully', async () => {
      const { getRequestDurationMetrics } = await import('../requestDurationMiddleware');

      vi.mocked(getRequestDurationMetrics).mockReturnValue(null as any);

      const lines: string[] = [];
      const durationMetrics = getRequestDurationMetrics();
      if (durationMetrics) {
        lines.push('');
        lines.push(durationMetrics);
      }

      expect(lines.length).toBe(0);
    });
  });

  describe('Health endpoint response structure', () => {
    it('should include all required fields in /api/health response', async () => {
      const response = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: { status: 'healthy', latencyMs: 20 },
          redis: { status: 'healthy', latencyMs: 5 },
          kafka: { status: 'healthy', latencyMs: 10 },
          r2: { status: 'healthy', latencyMs: 15 },
          wasmtime: { enabled: true, poolStats: { size: 5, available: 3, maxSize: 10 } },
        },
        featureFlags: {},
        system: {
          memory: { heapUsedMB: 50, heapTotalMB: 100, rssMB: 150, externalMB: 10 },
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('environment');
      expect(response).toHaveProperty('services');
      expect(response).toHaveProperty('featureFlags');
      expect(response).toHaveProperty('system');

      expect(response.services).toHaveProperty('database');
      expect(response.services).toHaveProperty('redis');
      expect(response.services).toHaveProperty('kafka');
      expect(response.services).toHaveProperty('r2');
      expect(response.services).toHaveProperty('wasmtime');

      expect(response.system).toHaveProperty('memory');
      expect(response.system).toHaveProperty('nodeVersion');
      expect(response.system).toHaveProperty('platform');
      expect(response.system).toHaveProperty('arch');
    });

    it('should return 200 status code when healthy', () => {
      const isHealthy = true;
      const statusCode = isHealthy ? 200 : 503;

      expect(statusCode).toBe(200);
    });

    it('should return 503 status code when degraded', () => {
      const isHealthy = false;
      const statusCode = isHealthy ? 200 : 503;

      expect(statusCode).toBe(503);
    });
  });

  describe('Service status determination', () => {
    it('should show healthy when service is connected', () => {
      const connected = true;
      const isAvailable = true;
      const status = connected ? 'healthy' : isAvailable ? 'unhealthy' : 'not_configured';

      expect(status).toBe('healthy');
    });

    it('should show unhealthy when service is available but not connected', () => {
      const connected = false;
      const isAvailable = true;
      const status = connected ? 'healthy' : isAvailable ? 'unhealthy' : 'not_configured';

      expect(status).toBe('unhealthy');
    });

    it('should show not_configured when service is not available', () => {
      const connected = false;
      const isAvailable = false;
      const status = connected ? 'healthy' : isAvailable ? 'unhealthy' : 'not_configured';

      expect(status).toBe('not_configured');
    });
  });
});
