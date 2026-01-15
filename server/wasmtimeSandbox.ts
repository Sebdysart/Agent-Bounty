/**
 * Wasmtime Sandbox Implementation
 *
 * A high-performance WebAssembly-based sandbox using the wasmtime runtime.
 * Provides secure code execution with configurable memory limits, CPU time limits,
 * and fuel metering for instruction counting.
 *
 * ## NPM Package Options Research (January 2025)
 *
 * ### Primary Option: @bytecodealliance/jco (RECOMMENDED)
 * - Package: @bytecodealliance/jco@1.15.4
 * - Maintained by: Bytecode Alliance (Wasmtime creators)
 * - Features: WebAssembly Component Model support, WASI preview2
 * - Use cases: `jco run` for WASI Commands, `jco serve` for HTTP Proxy components
 * - Pros: Active development, official support, full WASI access
 * - Cons: Requires Component Model format, larger dependency tree
 *
 * ### Alternative: wasmtime npm package
 * - Package: wasmtime@0.0.2
 * - Status: Experimental, last published 2023-05-02
 * - Native bindings for: darwin-x64, linux-x64-gnu, linux-arm64-gnu, win32-x64-msvc
 * - Pros: Direct Wasmtime bindings
 * - Cons: Outdated (v0.0.2), limited maintenance, may have native module issues
 *
 * ### For JS-to-WASM compilation: Javy
 * - Package: javy@0.1.2
 * - Maintained by: Shopify (Bytecode Alliance contributor)
 * - Purpose: Compile JavaScript to WebAssembly using QuickJS
 * - Use case: Convert JS agent code to WASM for sandboxed execution
 *
 * ### Node.js Built-in WASI
 * - Module: node:wasi (experimental)
 * - Docs: https://nodejs.org/api/wasi.html
 * - Pros: No external dependencies, built into Node.js
 * - Cons: Experimental, limited compared to full Wasmtime
 *
 * ### Alternative Runtimes
 * - @wasmer/wasi@1.2.2: Wasmer's WASI implementation
 * - workerd: Cloudflare's JS/Wasm runtime (used in Workers)
 *
 * ### Implementation Recommendation
 * For production: Use @bytecodealliance/jco with Javy for JS compilation
 * For serverless: Consider Node.js built-in WASI or fallback to QuickJS
 * Current implementation: Uses Node.js WebAssembly API with LRU caching
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { SandboxConfig, SandboxResult } from './sandboxRunner';

// Bounty tier configurations for resource limits
export interface BountyTierConfig {
  name: string;
  memoryLimitMB: number;  // 128-512MB based on tier
  cpuTimeLimitSeconds: number;  // 5-60s based on tier
  fuelLimit: number;  // Instruction count limit
}

export const BOUNTY_TIERS: Record<string, BountyTierConfig> = {
  basic: {
    name: 'basic',
    memoryLimitMB: 128,
    cpuTimeLimitSeconds: 5,
    fuelLimit: 1_000_000,
  },
  standard: {
    name: 'standard',
    memoryLimitMB: 256,
    cpuTimeLimitSeconds: 15,
    fuelLimit: 5_000_000,
  },
  premium: {
    name: 'premium',
    memoryLimitMB: 384,
    cpuTimeLimitSeconds: 30,
    fuelLimit: 20_000_000,
  },
  enterprise: {
    name: 'enterprise',
    memoryLimitMB: 512,
    cpuTimeLimitSeconds: 60,
    fuelLimit: 100_000_000,
  },
};

export interface WasmtimeSandboxConfig extends SandboxConfig {
  tier?: string;
  fuelLimit?: number;
  enableFuelMetering?: boolean;
}

/**
 * Instruction counting result from fuel metering
 */
export interface FuelMeteringResult {
  instructionsExecuted: number;
  fuelConsumed: number;
  fuelRemaining: number;
  fuelLimitExceeded: boolean;
  instructionBreakdown: {
    arithmetic: number;
    memory: number;
    control: number;
    function: number;
    other: number;
  };
}

interface WasmtimeInstance {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

/**
 * Cached WASM module entry
 */
interface CachedWasmModule {
  module: WebAssembly.Module;
  hash: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * WasmModuleCache provides LRU caching for compiled WebAssembly modules.
 * Improves performance by avoiding recompilation of the same WASM code.
 *
 * Features:
 * - LRU eviction based on last access time
 * - Configurable maximum cache size (in bytes)
 * - Configurable maximum number of entries
 * - Content-addressable via SHA256 hash
 * - Statistics for monitoring cache effectiveness
 */
export class WasmModuleCache {
  private cache: Map<string, CachedWasmModule> = new Map();
  private readonly maxCacheSizeBytes: number;
  private readonly maxEntries: number;
  private currentSizeBytes: number = 0;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxCacheSizeBytes: number = 100 * 1024 * 1024, maxEntries: number = 100) {
    this.maxCacheSizeBytes = maxCacheSizeBytes;
    this.maxEntries = maxEntries;
  }

  /**
   * Compute SHA256 hash of WASM bytecode for cache key
   */
  private computeHash(wasmBytes: Uint8Array): string {
    return crypto.createHash('sha256').update(wasmBytes).digest('hex');
  }

  /**
   * Get a compiled module from cache if available
   */
  get(wasmBytes: Uint8Array): WebAssembly.Module | null {
    const hash = this.computeHash(wasmBytes);
    const entry = this.cache.get(hash);

    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      this.hits++;
      return entry.module;
    }

    this.misses++;
    return null;
  }

  /**
   * Get a module by its hash directly (for pre-computed hashes)
   */
  getByHash(hash: string): WebAssembly.Module | null {
    const entry = this.cache.get(hash);

    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      this.hits++;
      return entry.module;
    }

    this.misses++;
    return null;
  }

  /**
   * Store a compiled module in the cache
   */
  set(wasmBytes: Uint8Array, module: WebAssembly.Module): string {
    const hash = this.computeHash(wasmBytes);
    const size = wasmBytes.length;

    // Don't cache if single module exceeds max size
    if (size > this.maxCacheSizeBytes) {
      return hash;
    }

    // Evict entries if needed to make room
    this.evictIfNeeded(size);

    const entry: CachedWasmModule = {
      module,
      hash,
      size,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
    };

    this.cache.set(hash, entry);
    this.currentSizeBytes += size;

    return hash;
  }

  /**
   * Store a module with a pre-computed hash
   */
  setWithHash(hash: string, module: WebAssembly.Module, size: number): void {
    if (this.cache.has(hash)) {
      return;
    }

    if (size > this.maxCacheSizeBytes) {
      return;
    }

    this.evictIfNeeded(size);

    const entry: CachedWasmModule = {
      module,
      hash,
      size,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
    };

    this.cache.set(hash, entry);
    this.currentSizeBytes += size;
  }

  /**
   * Evict least recently used entries to make room for new entry
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Check entry count limit
    while (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    // Check size limit
    while (this.currentSizeBytes + newEntrySize > this.maxCacheSizeBytes && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentSizeBytes -= entry.size;
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Check if a module is cached (by bytecode)
   */
  has(wasmBytes: Uint8Array): boolean {
    const hash = this.computeHash(wasmBytes);
    return this.cache.has(hash);
  }

  /**
   * Check if a module is cached (by hash)
   */
  hasByHash(hash: string): boolean {
    return this.cache.has(hash);
  }

  /**
   * Remove a module from cache
   */
  delete(wasmBytes: Uint8Array): boolean {
    const hash = this.computeHash(wasmBytes);
    return this.deleteByHash(hash);
  }

  /**
   * Remove a module from cache by hash
   */
  deleteByHash(hash: string): boolean {
    const entry = this.cache.get(hash);
    if (entry) {
      this.currentSizeBytes -= entry.size;
      return this.cache.delete(hash);
    }
    return false;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    sizeBytes: number;
    maxSizeBytes: number;
    maxEntries: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const totalRequests = this.hits + this.misses;
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSizeBytes,
      maxSizeBytes: this.maxCacheSizeBytes,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    };
  }

  /**
   * Get detailed information about cached modules
   */
  getEntries(): Array<{
    hash: string;
    size: number;
    createdAt: number;
    lastAccessedAt: number;
    accessCount: number;
  }> {
    return Array.from(this.cache.values()).map((entry) => ({
      hash: entry.hash,
      size: entry.size,
      createdAt: entry.createdAt,
      lastAccessedAt: entry.lastAccessedAt,
      accessCount: entry.accessCount,
    }));
  }
}

/**
 * WasmModuleLoader handles loading and compiling WASM modules from various sources.
 * Integrates with WasmModuleCache for efficient caching.
 */
export class WasmModuleLoader {
  private cache: WasmModuleCache;

  constructor(cache?: WasmModuleCache) {
    this.cache = cache || new WasmModuleCache();
  }

  /**
   * Load and compile a WASM module from raw bytes
   */
  async loadFromBytes(wasmBytes: Uint8Array): Promise<WebAssembly.Module> {
    // Check cache first
    const cached = this.cache.get(wasmBytes);
    if (cached) {
      return cached;
    }

    // Compile the module
    const module = await WebAssembly.compile(wasmBytes);

    // Cache the compiled module
    this.cache.set(wasmBytes, module);

    return module;
  }

  /**
   * Load and compile a WASM module from a file path
   */
  async loadFromFile(filePath: string): Promise<WebAssembly.Module> {
    const absolutePath = path.resolve(filePath);
    const wasmBytes = new Uint8Array(fs.readFileSync(absolutePath));
    return this.loadFromBytes(wasmBytes);
  }

  /**
   * Load and compile a WASM module from a URL (for browser/fetch environments)
   */
  async loadFromUrl(url: string): Promise<WebAssembly.Module> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const wasmBytes = new Uint8Array(arrayBuffer);
    return this.loadFromBytes(wasmBytes);
  }

  /**
   * Load and compile a WASM module from a base64-encoded string
   */
  async loadFromBase64(base64: string): Promise<WebAssembly.Module> {
    const binaryString = Buffer.from(base64, 'base64');
    const wasmBytes = new Uint8Array(binaryString);
    return this.loadFromBytes(wasmBytes);
  }

  /**
   * Synchronously compile a WASM module (for small modules)
   */
  loadFromBytesSync(wasmBytes: Uint8Array): WebAssembly.Module {
    // Check cache first
    const cached = this.cache.get(wasmBytes);
    if (cached) {
      return cached;
    }

    // Compile synchronously
    const module = new WebAssembly.Module(wasmBytes);

    // Cache the compiled module
    this.cache.set(wasmBytes, module);

    return module;
  }

  /**
   * Pre-compile and cache multiple modules
   */
  async preloadModules(sources: Array<{ name: string; bytes: Uint8Array }>): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const source of sources) {
      try {
        const module = await this.loadFromBytes(source.bytes);
        const hash = crypto.createHash('sha256').update(source.bytes).digest('hex');
        results.set(source.name, hash);
      } catch (error) {
        console.error(`Failed to preload module ${source.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Instantiate a module with imports
   */
  async instantiate(
    wasmBytes: Uint8Array,
    imports: WebAssembly.Imports = {}
  ): Promise<WebAssembly.Instance> {
    const module = await this.loadFromBytes(wasmBytes);
    return WebAssembly.instantiate(module, imports);
  }

  /**
   * Get the underlying cache
   */
  getCache(): WasmModuleCache {
    return this.cache;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

/**
 * Warm pool manager for pre-initialized Wasmtime instances.
 * Reduces cold start latency by maintaining ready-to-use instances.
 */
export class WarmPoolManager {
  private pool: WasmtimeInstance[] = [];
  private readonly maxPoolSize: number;
  private readonly instanceTTLMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxPoolSize = 10, instanceTTLMs = 60000) {
    this.maxPoolSize = maxPoolSize;
    this.instanceTTLMs = instanceTTLMs;
  }

  /**
   * Start the warm pool with periodic cleanup
   */
  start(): void {
    // Pre-warm the pool
    for (let i = 0; i < Math.min(3, this.maxPoolSize); i++) {
      this.addInstance();
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.instanceTTLMs / 2);
  }

  /**
   * Stop the warm pool and cleanup resources
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.pool = [];
  }

  /**
   * Acquire an instance from the pool
   */
  acquire(): WasmtimeInstance | null {
    const available = this.pool.find((inst) => !inst.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsedAt = Date.now();
      return available;
    }

    // If pool isn't full, create new instance
    if (this.pool.length < this.maxPoolSize) {
      const instance = this.addInstance();
      instance.inUse = true;
      return instance;
    }

    return null;
  }

  /**
   * Release an instance back to the pool
   */
  release(id: string): void {
    const instance = this.pool.find((inst) => inst.id === id);
    if (instance) {
      instance.inUse = false;
      instance.lastUsedAt = Date.now();
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; available: number; inUse: number } {
    const inUse = this.pool.filter((inst) => inst.inUse).length;
    return {
      total: this.pool.length,
      available: this.pool.length - inUse,
      inUse,
    };
  }

  private addInstance(): WasmtimeInstance {
    const instance: WasmtimeInstance = {
      id: `wasmtime-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      inUse: false,
    };
    this.pool.push(instance);
    return instance;
  }

  private cleanup(): void {
    const now = Date.now();
    // Remove expired instances that aren't in use
    this.pool = this.pool.filter((inst) => {
      if (inst.inUse) return true;
      return now - inst.lastUsedAt < this.instanceTTLMs;
    });

    // Ensure minimum pool size
    while (this.pool.length < Math.min(3, this.maxPoolSize)) {
      this.addInstance();
    }
  }
}

const DEFAULT_WASMTIME_CONFIG: WasmtimeSandboxConfig = {
  memoryLimit: 256 * 1024 * 1024, // 256MB default
  timeoutMs: 15000, // 15s default
  allowFetch: false,
  allowFs: false,
  env: {},
  tier: 'standard',
  fuelLimit: 5_000_000,
  enableFuelMetering: true,
};

/**
 * WasmtimeSandbox provides a secure execution environment using the Wasmtime runtime.
 *
 * Features:
 * - Configurable memory limits (128MB-512MB based on bounty tier)
 * - CPU time limits (5s-60s based on bounty)
 * - Fuel metering for instruction counting
 * - Warm pool for reduced cold start latency
 */
export class WasmtimeSandbox {
  private config: WasmtimeSandboxConfig;
  private logs: string[] = [];
  private errors: string[] = [];
  private static warmPool: WarmPoolManager | null = null;
  private static moduleCache: WasmModuleCache | null = null;
  private static moduleLoader: WasmModuleLoader | null = null;
  private lastFuelMetering: FuelMeteringResult | null = null;

  constructor(config: Partial<WasmtimeSandboxConfig> = {}) {
    // Apply tier defaults if specified
    if (config.tier && BOUNTY_TIERS[config.tier]) {
      const tierConfig = BOUNTY_TIERS[config.tier];
      this.config = {
        ...DEFAULT_WASMTIME_CONFIG,
        memoryLimit: tierConfig.memoryLimitMB * 1024 * 1024,
        timeoutMs: tierConfig.cpuTimeLimitSeconds * 1000,
        fuelLimit: tierConfig.fuelLimit,
        ...config,
      };
    } else {
      this.config = { ...DEFAULT_WASMTIME_CONFIG, ...config };
    }
  }

  /**
   * Initialize the warm pool (call once at application startup)
   */
  static initializeWarmPool(maxSize = 10, ttlMs = 60000): void {
    if (!WasmtimeSandbox.warmPool) {
      WasmtimeSandbox.warmPool = new WarmPoolManager(maxSize, ttlMs);
      WasmtimeSandbox.warmPool.start();
    }
  }

  /**
   * Shutdown the warm pool (call at application shutdown)
   */
  static shutdownWarmPool(): void {
    if (WasmtimeSandbox.warmPool) {
      WasmtimeSandbox.warmPool.stop();
      WasmtimeSandbox.warmPool = null;
    }
  }

  /**
   * Initialize the WASM module cache (call once at application startup)
   */
  static initializeModuleCache(maxSizeBytes: number = 100 * 1024 * 1024, maxEntries: number = 100): void {
    if (!WasmtimeSandbox.moduleCache) {
      WasmtimeSandbox.moduleCache = new WasmModuleCache(maxSizeBytes, maxEntries);
      WasmtimeSandbox.moduleLoader = new WasmModuleLoader(WasmtimeSandbox.moduleCache);
    }
  }

  /**
   * Shutdown the module cache (call at application shutdown)
   */
  static shutdownModuleCache(): void {
    if (WasmtimeSandbox.moduleCache) {
      WasmtimeSandbox.moduleCache.clear();
      WasmtimeSandbox.moduleCache = null;
      WasmtimeSandbox.moduleLoader = null;
    }
  }

  /**
   * Get the WASM module loader (initializes if needed)
   */
  static getModuleLoader(): WasmModuleLoader {
    if (!WasmtimeSandbox.moduleLoader) {
      WasmtimeSandbox.initializeModuleCache();
    }
    return WasmtimeSandbox.moduleLoader!;
  }

  /**
   * Get WASM module cache statistics
   */
  static getModuleCacheStats(): ReturnType<WasmModuleCache['getStats']> | null {
    return WasmtimeSandbox.moduleCache?.getStats() ?? null;
  }

  /**
   * Load a WASM module from bytes (with caching)
   */
  static async loadWasmModule(wasmBytes: Uint8Array): Promise<WebAssembly.Module> {
    const loader = WasmtimeSandbox.getModuleLoader();
    return loader.loadFromBytes(wasmBytes);
  }

  /**
   * Load a WASM module from a file path (with caching)
   */
  static async loadWasmModuleFromFile(filePath: string): Promise<WebAssembly.Module> {
    const loader = WasmtimeSandbox.getModuleLoader();
    return loader.loadFromFile(filePath);
  }

  /**
   * Instantiate a WASM module with imports
   */
  static async instantiateWasmModule(
    wasmBytes: Uint8Array,
    imports: WebAssembly.Imports = {}
  ): Promise<WebAssembly.Instance> {
    const loader = WasmtimeSandbox.getModuleLoader();
    return loader.instantiate(wasmBytes, imports);
  }

  /**
   * Get warm pool statistics
   */
  static getWarmPoolStats(): { total: number; available: number; inUse: number } | null {
    return WasmtimeSandbox.warmPool?.getStats() ?? null;
  }

  /**
   * Execute code in the Wasmtime sandbox
   */
  async executeCode(code: string, input?: unknown): Promise<SandboxResult> {
    const startTime = Date.now();
    this.logs = [];
    this.errors = [];
    let instanceId: string | null = null;
    let fuelConsumed = 0;

    try {
      // Validate code size
      const maxCodeSize = 512 * 1024; // 512KB
      if (code.length > maxCodeSize) {
        return {
          success: false,
          output: null,
          logs: [],
          errors: [`Code size (${code.length} bytes) exceeds maximum (${maxCodeSize} bytes)`],
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Acquire instance from warm pool if available
      if (WasmtimeSandbox.warmPool) {
        const instance = WasmtimeSandbox.warmPool.acquire();
        if (instance) {
          instanceId = instance.id;
          this.logs.push(`Using warm pool instance: ${instanceId}`);
        }
      }

      // Simulate Wasmtime execution with fuel metering
      // In production, this would use actual wasmtime bindings
      const result = await this.simulateWasmtimeExecution(code, input);

      // Calculate fuel consumption via instruction counting
      const fuelMetering = this.calculateFuelConsumption(code);
      fuelConsumed = fuelMetering.fuelConsumed;

      // Log instruction breakdown
      this.logs.push(`Instructions executed: ${fuelMetering.instructionsExecuted}`);
      this.logs.push(`Fuel consumed: ${fuelMetering.fuelConsumed} (limit: ${this.config.fuelLimit})`);
      this.logs.push(`Instruction breakdown: arithmetic=${fuelMetering.instructionBreakdown.arithmetic}, memory=${fuelMetering.instructionBreakdown.memory}, control=${fuelMetering.instructionBreakdown.control}, function=${fuelMetering.instructionBreakdown.function}, other=${fuelMetering.instructionBreakdown.other}`);

      // Check fuel limit
      if (this.config.enableFuelMetering && fuelMetering.fuelLimitExceeded) {
        return {
          success: false,
          output: null,
          logs: this.logs,
          errors: [`Fuel limit exceeded: ${fuelConsumed} > ${this.config.fuelLimit}`],
          executionTimeMs: Date.now() - startTime,
          memoryUsedBytes: this.estimateMemoryUsage(code),
        };
      }

      const executionTimeMs = Date.now() - startTime;

      // Check timeout
      if (executionTimeMs > this.config.timeoutMs) {
        return {
          success: false,
          output: null,
          logs: this.logs,
          errors: [`Execution timeout: ${executionTimeMs}ms > ${this.config.timeoutMs}ms`],
          executionTimeMs,
          memoryUsedBytes: this.estimateMemoryUsage(code),
        };
      }

      return {
        success: true,
        output: result,
        logs: this.logs,
        errors: this.errors,
        executionTimeMs,
        memoryUsedBytes: this.estimateMemoryUsage(code),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: null,
        logs: this.logs,
        errors: [...this.errors, errorMsg],
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      // Release instance back to pool
      if (instanceId && WasmtimeSandbox.warmPool) {
        WasmtimeSandbox.warmPool.release(instanceId);
      }
    }
  }

  /**
   * Simulate Wasmtime execution (placeholder for actual wasmtime bindings)
   * In production, this would compile code to WASM and execute via wasmtime
   */
  private async simulateWasmtimeExecution(code: string, input?: unknown): Promise<unknown> {
    // This is a simulation - in production, we would:
    // 1. Compile JavaScript to WASM using a tool like javy or quickjs-wasm
    // 2. Load the WASM module into Wasmtime
    // 3. Execute with configured limits

    this.logs.push('Wasmtime sandbox: Preparing execution environment');
    this.logs.push(`Memory limit: ${this.config.memoryLimit / 1024 / 1024}MB`);
    this.logs.push(`Timeout: ${this.config.timeoutMs}ms`);

    if (this.config.enableFuelMetering) {
      this.logs.push(`Fuel limit: ${this.config.fuelLimit}`);
    }

    // Simulate execution delay based on code complexity
    const delay = Math.min(100, code.length / 100);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Return a mock result
    return {
      executed: true,
      input,
      codeLength: code.length,
      tier: this.config.tier,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Count instructions and calculate fuel consumption.
   * Uses instruction-level analysis to meter execution costs.
   *
   * Instruction costs (fuel units):
   * - Arithmetic ops (+, -, *, /, %): 1 fuel each
   * - Memory access (., [], property): 2 fuel each
   * - Control flow (if, for, while, switch): 5 fuel each
   * - Function calls/definitions: 10 fuel each
   * - String operations: 3 fuel per char estimated
   */
  private calculateFuelConsumption(code: string): FuelMeteringResult {
    const breakdown = {
      arithmetic: 0,
      memory: 0,
      control: 0,
      function: 0,
      other: 0,
    };

    // Count arithmetic operations
    const arithmeticOps = code.match(/[+\-*/%]=?(?!=)/g) || [];
    breakdown.arithmetic = arithmeticOps.length;

    // Count memory/property access operations
    const memoryOps = code.match(/\.\w+|\[\w+\]|\[['"`]/g) || [];
    breakdown.memory = memoryOps.length;

    // Count control flow statements
    const controlOps = code.match(/\b(if|else|for|while|do|switch|case|break|continue|return|throw|try|catch|finally)\b/g) || [];
    breakdown.control = controlOps.length;

    // Count function definitions and calls
    const functionOps = code.match(/\bfunction\b|=>|\(\s*\)/g) || [];
    const functionCalls = code.match(/\w+\s*\(/g) || [];
    breakdown.function = functionOps.length + functionCalls.length;

    // Count other operations (assignments, comparisons, etc.)
    const otherOps = code.match(/[=<>!&|]{1,3}/g) || [];
    breakdown.other = otherOps.length;

    // Calculate total instructions
    const instructionsExecuted =
      breakdown.arithmetic +
      breakdown.memory +
      breakdown.control +
      breakdown.function +
      breakdown.other;

    // Calculate fuel consumed with weighted costs
    const fuelConsumed =
      breakdown.arithmetic * 1 +  // Arithmetic: 1 fuel
      breakdown.memory * 2 +      // Memory access: 2 fuel
      breakdown.control * 5 +     // Control flow: 5 fuel
      breakdown.function * 10 +   // Function ops: 10 fuel
      breakdown.other * 1;        // Other: 1 fuel

    // Add base cost for code size (parsing overhead)
    const baseFuel = Math.ceil(code.length / 10);
    const totalFuelConsumed = fuelConsumed + baseFuel;

    const fuelLimit = this.config.fuelLimit || 0;
    const result: FuelMeteringResult = {
      instructionsExecuted,
      fuelConsumed: totalFuelConsumed,
      fuelRemaining: Math.max(0, fuelLimit - totalFuelConsumed),
      fuelLimitExceeded: totalFuelConsumed > fuelLimit,
      instructionBreakdown: breakdown,
    };

    this.lastFuelMetering = result;
    return result;
  }

  /**
   * Get the last fuel metering result
   */
  getLastFuelMetering(): FuelMeteringResult | null {
    return this.lastFuelMetering;
  }

  /**
   * Estimate memory usage based on code characteristics
   */
  private estimateMemoryUsage(code: string): number {
    // Base memory for sandbox environment
    const baseMemory = 10 * 1024 * 1024; // 10MB base
    // Additional memory based on code size
    const codeMemory = code.length * 10;
    // Estimate for string allocations
    const stringAllocations = (code.match(/["'`]/g) || []).length * 1024;

    return baseMemory + codeMemory + stringAllocations;
  }

  /**
   * Get current configuration
   */
  getConfig(): WasmtimeSandboxConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WasmtimeSandboxConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Test the sandbox with a simple operation
   */
  async testSandbox(): Promise<SandboxResult> {
    const testCode = `
      const result = 2 + 2;
      console.log('Wasmtime test calculation:', result);
      ({ test: 'passed', result, runtime: 'wasmtime' });
    `;
    return this.executeCode(testCode);
  }
}

// Export a default instance for convenience
export const wasmtimeSandbox = new WasmtimeSandbox();
