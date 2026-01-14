/**
 * WasmtimeSandbox Tests - Memory limits per bounty tier
 *
 * Tests the Wasmtime-based sandbox functionality including:
 * - Configurable memory limits (128MB-512MB based on bounty tier)
 * - CPU time limits
 * - Fuel metering for instruction counting
 * - Warm pool management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WasmtimeSandbox,
  WarmPoolManager,
  BOUNTY_TIERS,
  type BountyTierConfig,
} from '../wasmtimeSandbox';

describe('WasmtimeSandbox', () => {
  afterEach(() => {
    WasmtimeSandbox.shutdownWarmPool();
  });

  describe('Memory Limits - Bounty Tiers', () => {
    it('should configure basic tier with 128MB memory limit', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'basic' });
      const config = sandbox.getConfig();

      expect(config.memoryLimit).toBe(128 * 1024 * 1024);
      expect(config.tier).toBe('basic');
    });

    it('should configure standard tier with 256MB memory limit', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const config = sandbox.getConfig();

      expect(config.memoryLimit).toBe(256 * 1024 * 1024);
      expect(config.tier).toBe('standard');
    });

    it('should configure premium tier with 384MB memory limit', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'premium' });
      const config = sandbox.getConfig();

      expect(config.memoryLimit).toBe(384 * 1024 * 1024);
      expect(config.tier).toBe('premium');
    });

    it('should configure enterprise tier with 512MB memory limit', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'enterprise' });
      const config = sandbox.getConfig();

      expect(config.memoryLimit).toBe(512 * 1024 * 1024);
      expect(config.tier).toBe('enterprise');
    });

    it('should fall back to default (standard) for unknown tier', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'unknown' });
      const config = sandbox.getConfig();

      // Falls back to default config (standard tier values)
      expect(config.memoryLimit).toBe(256 * 1024 * 1024);
    });

    it('should allow custom memory limit override', () => {
      const customLimit = 192 * 1024 * 1024; // 192MB
      const sandbox = new WasmtimeSandbox({
        tier: 'basic',
        memoryLimit: customLimit,
      });
      const config = sandbox.getConfig();

      expect(config.memoryLimit).toBe(customLimit);
    });
  });

  describe('BOUNTY_TIERS configuration', () => {
    it('should have all required tiers defined', () => {
      expect(BOUNTY_TIERS).toHaveProperty('basic');
      expect(BOUNTY_TIERS).toHaveProperty('standard');
      expect(BOUNTY_TIERS).toHaveProperty('premium');
      expect(BOUNTY_TIERS).toHaveProperty('enterprise');
    });

    it('should have memory limits within 128MB-512MB range', () => {
      const MIN_MB = 128;
      const MAX_MB = 512;

      Object.values(BOUNTY_TIERS).forEach((tier: BountyTierConfig) => {
        expect(tier.memoryLimitMB).toBeGreaterThanOrEqual(MIN_MB);
        expect(tier.memoryLimitMB).toBeLessThanOrEqual(MAX_MB);
      });
    });

    it('should have CPU time limits within 5-60s range', () => {
      const MIN_S = 5;
      const MAX_S = 60;

      Object.values(BOUNTY_TIERS).forEach((tier: BountyTierConfig) => {
        expect(tier.cpuTimeLimitSeconds).toBeGreaterThanOrEqual(MIN_S);
        expect(tier.cpuTimeLimitSeconds).toBeLessThanOrEqual(MAX_S);
      });
    });

    it('should have increasing limits from basic to enterprise', () => {
      const tiers = ['basic', 'standard', 'premium', 'enterprise'];

      for (let i = 1; i < tiers.length; i++) {
        const prev = BOUNTY_TIERS[tiers[i - 1]];
        const curr = BOUNTY_TIERS[tiers[i]];

        expect(curr.memoryLimitMB).toBeGreaterThan(prev.memoryLimitMB);
        expect(curr.cpuTimeLimitSeconds).toBeGreaterThan(prev.cpuTimeLimitSeconds);
        expect(curr.fuelLimit).toBeGreaterThan(prev.fuelLimit);
      }
    });
  });

  describe('CPU Time Limits', () => {
    it('should configure timeout based on tier', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'basic' });
      const config = sandbox.getConfig();

      expect(config.timeoutMs).toBe(5 * 1000); // 5 seconds
    });

    it('should allow custom timeout override', () => {
      const customTimeout = 10000; // 10s
      const sandbox = new WasmtimeSandbox({
        tier: 'basic',
        timeoutMs: customTimeout,
      });
      const config = sandbox.getConfig();

      expect(config.timeoutMs).toBe(customTimeout);
    });
  });

  describe('Fuel Metering', () => {
    it('should configure fuel limit based on tier', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'basic' });
      const config = sandbox.getConfig();

      expect(config.fuelLimit).toBe(1_000_000);
      expect(config.enableFuelMetering).toBe(true);
    });

    it('should allow disabling fuel metering', () => {
      const sandbox = new WasmtimeSandbox({
        tier: 'standard',
        enableFuelMetering: false,
      });
      const config = sandbox.getConfig();

      expect(config.enableFuelMetering).toBe(false);
    });

    it('should fail execution when fuel limit is exceeded', async () => {
      const sandbox = new WasmtimeSandbox({
        tier: 'basic',
        fuelLimit: 100, // Very low limit
      });

      // Code with loops that would consume more than 100 fuel
      const code = `
        for (let i = 0; i < 100; i++) {
          for (let j = 0; j < 100; j++) {
            const x = i * j;
          }
        }
      `;

      const result = await sandbox.executeCode(code);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Fuel limit exceeded');
    });
  });

  describe('Code Execution', () => {
    it('should execute simple code successfully', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const result = await sandbox.executeCode('const x = 1 + 1;');

      expect(result.success).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should reject oversized code', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const oversizedCode = 'x'.repeat(600 * 1024); // 600KB

      const result = await sandbox.executeCode(oversizedCode);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Code size');
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('should include memory usage in result', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const result = await sandbox.executeCode('const x = "hello";');

      expect(result.memoryUsedBytes).toBeDefined();
      expect(result.memoryUsedBytes).toBeGreaterThan(0);
    });

    it('should pass input to execution', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const input = { name: 'test' };

      const result = await sandbox.executeCode('const x = 1;', input);

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('input', input);
    });
  });

  describe('Test Sandbox', () => {
    it('should run test successfully', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const result = await sandbox.testSandbox();

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('executed', true);
      expect(result.output).toHaveProperty('tier', 'standard');
    });
  });

  describe('Configuration Updates', () => {
    it('should allow updating configuration', () => {
      const sandbox = new WasmtimeSandbox({ tier: 'basic' });

      sandbox.updateConfig({ memoryLimit: 192 * 1024 * 1024 });

      const config = sandbox.getConfig();
      expect(config.memoryLimit).toBe(192 * 1024 * 1024);
    });
  });
});

describe('WarmPoolManager', () => {
  let pool: WarmPoolManager;

  beforeEach(() => {
    pool = new WarmPoolManager(5, 1000);
  });

  afterEach(() => {
    pool.stop();
  });

  describe('Pool Management', () => {
    it('should start with pre-warmed instances', () => {
      pool.start();
      const stats = pool.getStats();

      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.available).toBeGreaterThanOrEqual(3);
      expect(stats.inUse).toBe(0);
    });

    it('should acquire and release instances', () => {
      pool.start();

      const instance = pool.acquire();
      expect(instance).not.toBeNull();
      expect(instance?.inUse).toBe(true);

      let stats = pool.getStats();
      expect(stats.inUse).toBe(1);

      pool.release(instance!.id);
      stats = pool.getStats();
      expect(stats.inUse).toBe(0);
    });

    it('should return null when pool is exhausted', () => {
      pool = new WarmPoolManager(2, 1000);
      pool.start();

      // Acquire all instances
      const inst1 = pool.acquire();
      const inst2 = pool.acquire();

      expect(inst1).not.toBeNull();
      expect(inst2).not.toBeNull();

      // Pool should be exhausted
      const inst3 = pool.acquire();
      expect(inst3).toBeNull();
    });

    it('should stop and clear pool', () => {
      pool.start();
      expect(pool.getStats().total).toBeGreaterThan(0);

      pool.stop();
      expect(pool.getStats().total).toBe(0);
    });
  });

  describe('Static Warm Pool', () => {
    afterEach(() => {
      WasmtimeSandbox.shutdownWarmPool();
    });

    it('should initialize global warm pool', () => {
      WasmtimeSandbox.initializeWarmPool(5, 1000);
      const stats = WasmtimeSandbox.getWarmPoolStats();

      expect(stats).not.toBeNull();
      expect(stats?.total).toBeGreaterThanOrEqual(3);
    });

    it('should not reinitialize if already started', () => {
      WasmtimeSandbox.initializeWarmPool(5, 1000);
      const stats1 = WasmtimeSandbox.getWarmPoolStats();

      WasmtimeSandbox.initializeWarmPool(10, 2000);
      const stats2 = WasmtimeSandbox.getWarmPoolStats();

      // Should still have same pool (not reinitialized)
      expect(stats2?.total).toBe(stats1?.total);
    });

    it('should shutdown global warm pool', () => {
      WasmtimeSandbox.initializeWarmPool(5, 1000);
      expect(WasmtimeSandbox.getWarmPoolStats()).not.toBeNull();

      WasmtimeSandbox.shutdownWarmPool();
      expect(WasmtimeSandbox.getWarmPoolStats()).toBeNull();
    });

    it('should use warm pool during execution', async () => {
      WasmtimeSandbox.initializeWarmPool(5, 1000);

      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const result = await sandbox.executeCode('const x = 1;');

      expect(result.success).toBe(true);
      expect(result.logs.some((log: string) => log.includes('warm pool'))).toBe(true);
    });
  });
});
