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
  WasmModuleCache,
  WasmModuleLoader,
  BOUNTY_TIERS,
  type BountyTierConfig,
  type FuelMeteringResult,
} from '../wasmtimeSandbox';

// Minimal valid WASM module (empty module with magic number and version)
const MINIMAL_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic: \0asm
  0x01, 0x00, 0x00, 0x00, // version: 1
]);

// Another minimal WASM for testing different modules
const MINIMAL_WASM_2 = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic: \0asm
  0x01, 0x00, 0x00, 0x00, // version: 1
  0x00, 0x00, 0x00, 0x00, // custom section (empty)
]);

describe('WasmtimeSandbox', () => {
  afterEach(() => {
    WasmtimeSandbox.shutdownWarmPool();
    WasmtimeSandbox.shutdownModuleCache();
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
        fuelLimit: 10, // Very low limit
      });

      // Code with loops and function calls that will exceed limit
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

    it('should count instructions by category', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const code = `
        const x = 1 + 2;
        const y = x * 3;
        if (y > 0) {
          console.log(y);
        }
      `;

      await sandbox.executeCode(code);
      const metering = sandbox.getLastFuelMetering();

      expect(metering).not.toBeNull();
      expect(metering!.instructionsExecuted).toBeGreaterThan(0);
      expect(metering!.instructionBreakdown.arithmetic).toBeGreaterThan(0);
      expect(metering!.instructionBreakdown.control).toBeGreaterThan(0);
    });

    it('should track fuel remaining after execution', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const code = 'const x = 1;';

      await sandbox.executeCode(code);
      const metering = sandbox.getLastFuelMetering();

      expect(metering).not.toBeNull();
      expect(metering!.fuelRemaining).toBeGreaterThan(0);
      expect(metering!.fuelLimitExceeded).toBe(false);
    });

    it('should log instruction breakdown in execution logs', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const code = 'const x = 1 + 2;';

      const result = await sandbox.executeCode(code);

      expect(result.logs.some((log: string) => log.includes('Instructions executed'))).toBe(true);
      expect(result.logs.some((log: string) => log.includes('Fuel consumed'))).toBe(true);
      expect(result.logs.some((log: string) => log.includes('Instruction breakdown'))).toBe(true);
    });

    it('should count function definitions and calls', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });
      const code = `
        function add(a, b) { return a + b; }
        const sum = add(1, 2);
        const arrow = (x) => x * 2;
      `;

      await sandbox.executeCode(code);
      const metering = sandbox.getLastFuelMetering();

      expect(metering).not.toBeNull();
      expect(metering!.instructionBreakdown.function).toBeGreaterThanOrEqual(3); // function def + 2 calls
    });

    it('should weight control flow operations higher than arithmetic', async () => {
      const sandbox = new WasmtimeSandbox({ tier: 'standard' });

      // Code with control flow
      const controlCode = 'if (true) { for (let i = 0; i < 1; i++) { while(false) {} } }';
      await sandbox.executeCode(controlCode);
      const controlMetering = sandbox.getLastFuelMetering();

      // Code with only arithmetic
      const arithCode = 'const x = 1 + 2 + 3 + 4 + 5;';
      await sandbox.executeCode(arithCode);
      const arithMetering = sandbox.getLastFuelMetering();

      // Control flow should consume more fuel per instruction
      const controlFuelPerInstr = controlMetering!.fuelConsumed / Math.max(1, controlMetering!.instructionsExecuted);
      const arithFuelPerInstr = arithMetering!.fuelConsumed / Math.max(1, arithMetering!.instructionsExecuted);

      expect(controlFuelPerInstr).toBeGreaterThan(arithFuelPerInstr);
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

describe('WasmModuleCache', () => {
  let cache: WasmModuleCache;

  beforeEach(() => {
    cache = new WasmModuleCache(1024 * 1024, 10); // 1MB, 10 entries
  });

  describe('Basic Operations', () => {
    it('should cache and retrieve modules', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      const cached = cache.get(MINIMAL_WASM);
      expect(cached).toBe(module);
    });

    it('should return null for uncached modules', () => {
      const result = cache.get(MINIMAL_WASM);
      expect(result).toBeNull();
    });

    it('should check if module is cached', async () => {
      expect(cache.has(MINIMAL_WASM)).toBe(false);

      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      expect(cache.has(MINIMAL_WASM)).toBe(true);
    });

    it('should delete cached modules', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);
      expect(cache.has(MINIMAL_WASM)).toBe(true);

      cache.delete(MINIMAL_WASM);
      expect(cache.has(MINIMAL_WASM)).toBe(false);
    });

    it('should clear all cached modules', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      cache.clear();
      expect(cache.has(MINIMAL_WASM)).toBe(false);
      expect(cache.getStats().entries).toBe(0);
    });
  });

  describe('Hash-based Operations', () => {
    it('should retrieve by hash', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      const hash = cache.set(MINIMAL_WASM, module);

      const cached = cache.getByHash(hash);
      expect(cached).toBe(module);
    });

    it('should check by hash', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      const hash = cache.set(MINIMAL_WASM, module);

      expect(cache.hasByHash(hash)).toBe(true);
      expect(cache.hasByHash('nonexistent')).toBe(false);
    });

    it('should delete by hash', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      const hash = cache.set(MINIMAL_WASM, module);

      expect(cache.deleteByHash(hash)).toBe(true);
      expect(cache.hasByHash(hash)).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track cache hits', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      // 3 hits
      cache.get(MINIMAL_WASM);
      cache.get(MINIMAL_WASM);
      cache.get(MINIMAL_WASM);

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should track cache misses', () => {
      cache.get(MINIMAL_WASM);
      cache.get(MINIMAL_WASM);

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      cache.get(MINIMAL_WASM); // hit
      cache.get(MINIMAL_WASM); // hit
      cache.get(MINIMAL_WASM_2); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should track size and entries', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      const stats = cache.getStats();
      expect(stats.entries).toBe(1);
      expect(stats.sizeBytes).toBe(MINIMAL_WASM.length);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict LRU entries when max entries exceeded', async () => {
      const smallCache = new WasmModuleCache(1024 * 1024, 2); // Max 2 entries
      const module = await WebAssembly.compile(MINIMAL_WASM);

      // Add 3 modules - first should be evicted
      const hash1 = smallCache.set(MINIMAL_WASM, module);
      await new Promise((r) => setTimeout(r, 10)); // Small delay to ensure different timestamps

      const module2 = await WebAssembly.compile(MINIMAL_WASM);
      smallCache.set(new Uint8Array([...MINIMAL_WASM, 1]), module2);
      await new Promise((r) => setTimeout(r, 10));

      const module3 = await WebAssembly.compile(MINIMAL_WASM);
      smallCache.set(new Uint8Array([...MINIMAL_WASM, 2]), module3);

      const stats = smallCache.getStats();
      expect(stats.entries).toBeLessThanOrEqual(2);
    });

    it('should evict entries when size limit exceeded', async () => {
      const smallCache = new WasmModuleCache(20, 100); // 20 bytes max
      const module = await WebAssembly.compile(MINIMAL_WASM);

      // MINIMAL_WASM is 8 bytes, adding 3 should trigger eviction
      smallCache.set(MINIMAL_WASM, module);
      smallCache.set(new Uint8Array([...MINIMAL_WASM, 1]), module);
      smallCache.set(new Uint8Array([...MINIMAL_WASM, 2]), module);

      const stats = smallCache.getStats();
      expect(stats.sizeBytes).toBeLessThanOrEqual(20);
    });

    it('should update access time on get', async () => {
      const smallCache = new WasmModuleCache(1024 * 1024, 2);
      const module = await WebAssembly.compile(MINIMAL_WASM);

      // Add two entries
      const hash1 = smallCache.set(MINIMAL_WASM, module);
      await new Promise((r) => setTimeout(r, 10));

      const hash2 = smallCache.set(new Uint8Array([...MINIMAL_WASM, 1]), module);
      await new Promise((r) => setTimeout(r, 10));

      // Access first entry (makes it most recently used)
      smallCache.getByHash(hash1);

      // Add third entry - should evict second (now LRU)
      smallCache.set(new Uint8Array([...MINIMAL_WASM, 2]), module);

      // First should still be present
      expect(smallCache.hasByHash(hash1)).toBe(true);
    });
  });

  describe('Entry Details', () => {
    it('should return detailed entry information', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      const hash = cache.set(MINIMAL_WASM, module);

      const entries = cache.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        hash,
        size: MINIMAL_WASM.length,
        accessCount: 1,
      });
      expect(entries[0].createdAt).toBeDefined();
      expect(entries[0].lastAccessedAt).toBeDefined();
    });

    it('should increment access count', async () => {
      const module = await WebAssembly.compile(MINIMAL_WASM);
      cache.set(MINIMAL_WASM, module);

      cache.get(MINIMAL_WASM);
      cache.get(MINIMAL_WASM);
      cache.get(MINIMAL_WASM);

      const entries = cache.getEntries();
      expect(entries[0].accessCount).toBe(4); // 1 initial + 3 gets
    });
  });
});

describe('WasmModuleLoader', () => {
  let loader: WasmModuleLoader;

  beforeEach(() => {
    loader = new WasmModuleLoader();
  });

  describe('Loading from Bytes', () => {
    it('should load and compile module from bytes', async () => {
      const module = await loader.loadFromBytes(MINIMAL_WASM);
      expect(module).toBeInstanceOf(WebAssembly.Module);
    });

    it('should cache loaded modules', async () => {
      const module1 = await loader.loadFromBytes(MINIMAL_WASM);
      const module2 = await loader.loadFromBytes(MINIMAL_WASM);

      // Same module reference from cache
      expect(module1).toBe(module2);

      const stats = loader.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should load synchronously', () => {
      const module = loader.loadFromBytesSync(MINIMAL_WASM);
      expect(module).toBeInstanceOf(WebAssembly.Module);
    });
  });

  describe('Loading from Base64', () => {
    it('should load module from base64', async () => {
      const base64 = Buffer.from(MINIMAL_WASM).toString('base64');
      const module = await loader.loadFromBase64(base64);
      expect(module).toBeInstanceOf(WebAssembly.Module);
    });
  });

  describe('Instantiation', () => {
    it('should instantiate module with imports', async () => {
      const instance = await loader.instantiate(MINIMAL_WASM, {});
      expect(instance).toBeInstanceOf(WebAssembly.Instance);
    });
  });

  describe('Cache Access', () => {
    it('should expose cache', () => {
      const cache = loader.getCache();
      expect(cache).toBeInstanceOf(WasmModuleCache);
    });

    it('should share cache statistics', async () => {
      await loader.loadFromBytes(MINIMAL_WASM);
      await loader.loadFromBytes(MINIMAL_WASM);

      const stats = loader.getCacheStats();
      expect(stats.entries).toBe(1);
      expect(stats.hits).toBe(1);
    });
  });

  describe('Preloading', () => {
    it('should preload multiple modules', async () => {
      const sources = [
        { name: 'module1', bytes: MINIMAL_WASM },
        { name: 'module2', bytes: new Uint8Array([...MINIMAL_WASM, 0]) },
      ];

      const results = await loader.preloadModules(sources);

      expect(results.size).toBe(2);
      expect(results.has('module1')).toBe(true);
      expect(results.has('module2')).toBe(true);

      const stats = loader.getCacheStats();
      expect(stats.entries).toBe(2);
    });
  });
});

describe('WasmtimeSandbox Module Cache Integration', () => {
  afterEach(() => {
    WasmtimeSandbox.shutdownModuleCache();
  });

  it('should initialize module cache', () => {
    WasmtimeSandbox.initializeModuleCache(50 * 1024 * 1024, 50);
    const stats = WasmtimeSandbox.getModuleCacheStats();

    expect(stats).not.toBeNull();
    expect(stats?.maxSizeBytes).toBe(50 * 1024 * 1024);
    expect(stats?.maxEntries).toBe(50);
  });

  it('should not reinitialize existing cache', () => {
    WasmtimeSandbox.initializeModuleCache(50 * 1024 * 1024, 50);
    WasmtimeSandbox.initializeModuleCache(100 * 1024 * 1024, 100);

    const stats = WasmtimeSandbox.getModuleCacheStats();
    expect(stats?.maxSizeBytes).toBe(50 * 1024 * 1024); // Original values
  });

  it('should load WASM module via static method', async () => {
    const module = await WasmtimeSandbox.loadWasmModule(MINIMAL_WASM);
    expect(module).toBeInstanceOf(WebAssembly.Module);

    const stats = WasmtimeSandbox.getModuleCacheStats();
    expect(stats?.entries).toBe(1);
  });

  it('should instantiate WASM module via static method', async () => {
    const instance = await WasmtimeSandbox.instantiateWasmModule(MINIMAL_WASM, {});
    expect(instance).toBeInstanceOf(WebAssembly.Instance);
  });

  it('should get module loader', () => {
    const loader = WasmtimeSandbox.getModuleLoader();
    expect(loader).toBeInstanceOf(WasmModuleLoader);
  });

  it('should shutdown and clear module cache', async () => {
    await WasmtimeSandbox.loadWasmModule(MINIMAL_WASM);
    expect(WasmtimeSandbox.getModuleCacheStats()?.entries).toBe(1);

    WasmtimeSandbox.shutdownModuleCache();
    expect(WasmtimeSandbox.getModuleCacheStats()).toBeNull();
  });
});
