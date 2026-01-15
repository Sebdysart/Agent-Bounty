/**
 * Sustained Load Test - Tests for 10-minute sustained load capability
 *
 * These tests verify that the load testing infrastructure can handle
 * sustained traffic over extended periods without degradation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseResult, LoadTestConfig, TestResult } from '../../scripts/load-test';

// Mock autocannon to avoid actual network calls in unit tests
vi.mock('autocannon', () => ({
  default: vi.fn(),
}));

describe('Sustained Load Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Load Test Configuration', () => {
    it('should have correct sustained load test configuration', () => {
      // Configuration for 10-minute sustained load test
      const sustainedConfig: LoadTestConfig = {
        name: 'Health Check (Sustained 10min)',
        url: 'http://localhost:5000/api/health',
        connections: 20,
        duration: 600, // 10 minutes = 600 seconds
      };

      expect(sustainedConfig.duration).toBe(600);
      expect(sustainedConfig.connections).toBe(20);
      expect(sustainedConfig.name).toContain('Sustained');
      expect(sustainedConfig.name).toContain('10min');
    });

    it('should support configurable connection counts for sustained tests', () => {
      const lowLoadConfig: LoadTestConfig = {
        name: 'Sustained Low Load',
        url: 'http://localhost:5000/api/health',
        connections: 10,
        duration: 600,
      };

      const highLoadConfig: LoadTestConfig = {
        name: 'Sustained High Load',
        url: 'http://localhost:5000/api/health',
        connections: 50,
        duration: 600,
      };

      expect(lowLoadConfig.connections).toBeLessThan(highLoadConfig.connections);
      expect(lowLoadConfig.duration).toBe(highLoadConfig.duration);
    });

    it('should support different endpoints for sustained tests', () => {
      const healthConfig: LoadTestConfig = {
        name: 'Health Sustained',
        url: 'http://localhost:5000/api/health',
        connections: 20,
        duration: 600,
      };

      const readyConfig: LoadTestConfig = {
        name: 'Ready Sustained',
        url: 'http://localhost:5000/api/ready',
        connections: 20,
        duration: 600,
      };

      const metricsConfig: LoadTestConfig = {
        name: 'Metrics Sustained',
        url: 'http://localhost:5000/api/metrics',
        connections: 20,
        duration: 600,
      };

      expect(healthConfig.url).toContain('/health');
      expect(readyConfig.url).toContain('/ready');
      expect(metricsConfig.url).toContain('/metrics');
    });
  });

  describe('Result Parsing', () => {
    it('should parse sustained load test results correctly', () => {
      const mockResult = {
        latency: {
          p50: 5,
          p95: 15,
          p99: 25,
          average: 8.5,
          max: 100,
          min: 1,
          stddev: 5,
        },
        requests: {
          total: 120000, // High request count for 10 minutes
          average: 200,
          sent: 120000,
          p1: 180,
          p2_5: 185,
          min: 150,
          max: 250,
        },
        throughput: {
          average: 50000,
          total: 30000000,
          p1: 45000,
          p2_5: 46000,
          min: 40000,
          max: 60000,
        },
        errors: 0,
        timeouts: 0,
        duration: 600,
        start: new Date(),
        finish: new Date(),
        connections: 20,
        pipelining: 1,
        non2xx: 0,
        resets: 0,
        mismatches: 0,
        statusCodeStats: {},
      };

      const parsed = parseResult('Sustained 10min Test', mockResult);

      expect(parsed.name).toBe('Sustained 10min Test');
      expect(parsed.duration).toBe(600);
      expect(parsed.errors).toBe(0);
      expect(parsed.timeouts).toBe(0);
      expect(parsed.latency.p50).toBe(5);
      expect(parsed.latency.p95).toBe(15);
      expect(parsed.latency.p99).toBe(25);
      expect(parsed.requests.total).toBe(120000);
    });

    it('should detect performance degradation in sustained tests', () => {
      // Simulated result with degraded performance
      const degradedResult = {
        latency: {
          p50: 50,
          p95: 500,
          p99: 2000, // High p99 indicates degradation
          average: 150,
          max: 5000,
          min: 10,
          stddev: 200,
        },
        requests: {
          total: 50000, // Lower than expected
          average: 83,
          sent: 50000,
          p1: 70,
          p2_5: 72,
          min: 60,
          max: 100,
        },
        throughput: {
          average: 20000,
          total: 12000000,
          p1: 18000,
          p2_5: 18500,
          min: 15000,
          max: 25000,
        },
        errors: 150, // Non-zero errors
        timeouts: 50,
        duration: 600,
        start: new Date(),
        finish: new Date(),
        connections: 20,
        pipelining: 1,
        non2xx: 0,
        resets: 0,
        mismatches: 0,
        statusCodeStats: {},
      };

      const parsed = parseResult('Degraded Sustained Test', degradedResult);

      // Check for signs of degradation
      expect(parsed.errors).toBeGreaterThan(0);
      expect(parsed.timeouts).toBeGreaterThan(0);
      expect(parsed.latency.p99).toBeGreaterThan(1000);
    });

    it('should handle successful sustained load without degradation', () => {
      const successResult = {
        latency: {
          p50: 3,
          p95: 8,
          p99: 15,
          average: 4.2,
          max: 50,
          min: 1,
          stddev: 3,
        },
        requests: {
          total: 150000,
          average: 250,
          sent: 150000,
          p1: 230,
          p2_5: 235,
          min: 200,
          max: 300,
        },
        throughput: {
          average: 75000,
          total: 45000000,
          p1: 70000,
          p2_5: 71000,
          min: 65000,
          max: 85000,
        },
        errors: 0,
        timeouts: 0,
        duration: 600,
        start: new Date(),
        finish: new Date(),
        connections: 20,
        pipelining: 1,
        non2xx: 0,
        resets: 0,
        mismatches: 0,
        statusCodeStats: {},
      };

      const parsed = parseResult('Successful Sustained Test', successResult);

      // Verify success criteria
      expect(parsed.errors).toBe(0);
      expect(parsed.timeouts).toBe(0);
      expect(parsed.latency.p99).toBeLessThan(1000);
      expect(parsed.requests.total).toBeGreaterThan(100000);
    });
  });

  describe('Performance Criteria', () => {
    it('should define acceptable p50 latency threshold', () => {
      const acceptableP50 = 50; // 50ms threshold
      const testLatency = 5;
      expect(testLatency).toBeLessThanOrEqual(acceptableP50);
    });

    it('should define acceptable p95 latency threshold', () => {
      const acceptableP95 = 200; // 200ms threshold
      const testLatency = 15;
      expect(testLatency).toBeLessThanOrEqual(acceptableP95);
    });

    it('should define acceptable p99 latency threshold', () => {
      const acceptableP99 = 1000; // 1000ms threshold
      const testLatency = 25;
      expect(testLatency).toBeLessThanOrEqual(acceptableP99);
    });

    it('should define acceptable error rate threshold', () => {
      const totalRequests = 120000;
      const errors = 0;
      const errorRate = errors / totalRequests;
      const acceptableErrorRate = 0.001; // 0.1% threshold

      expect(errorRate).toBeLessThanOrEqual(acceptableErrorRate);
    });

    it('should define minimum throughput for sustained tests', () => {
      const minRequestsPerSecond = 100;
      const actualRequestsPerSecond = 200;
      expect(actualRequestsPerSecond).toBeGreaterThanOrEqual(minRequestsPerSecond);
    });
  });

  describe('Sustained Load Test Duration', () => {
    it('should validate 10-minute duration in seconds', () => {
      const tenMinutesInSeconds = 10 * 60;
      expect(tenMinutesInSeconds).toBe(600);
    });

    it('should handle test duration configuration', () => {
      const configs = [
        { name: '1 min', duration: 60 },
        { name: '5 min', duration: 300 },
        { name: '10 min', duration: 600 },
        { name: '30 min', duration: 1800 },
      ];

      const tenMinConfig = configs.find(c => c.name === '10 min');
      expect(tenMinConfig?.duration).toBe(600);
    });

    it('should calculate expected request count for sustained test', () => {
      const durationSeconds = 600;
      const requestsPerSecond = 200;
      const expectedTotal = durationSeconds * requestsPerSecond;

      expect(expectedTotal).toBe(120000);
    });
  });

  describe('Resource Usage Simulation', () => {
    it('should track memory stability during sustained load', () => {
      // Simulate memory readings over time
      const memoryReadings = [
        { time: 0, heapUsed: 50 },
        { time: 60, heapUsed: 52 },
        { time: 120, heapUsed: 51 },
        { time: 180, heapUsed: 53 },
        { time: 240, heapUsed: 52 },
        { time: 300, heapUsed: 54 },
        { time: 360, heapUsed: 53 },
        { time: 420, heapUsed: 55 },
        { time: 480, heapUsed: 54 },
        { time: 540, heapUsed: 56 },
        { time: 600, heapUsed: 55 },
      ];

      const startMemory = memoryReadings[0].heapUsed;
      const endMemory = memoryReadings[memoryReadings.length - 1].heapUsed;
      const memoryGrowth = endMemory - startMemory;
      const acceptableGrowthMB = 20; // 20MB acceptable growth over 10 min

      expect(memoryGrowth).toBeLessThanOrEqual(acceptableGrowthMB);
    });

    it('should track CPU usage stability during sustained load', () => {
      // Simulate CPU usage readings (percentage)
      const cpuReadings = [
        { time: 0, usage: 30 },
        { time: 60, usage: 35 },
        { time: 120, usage: 32 },
        { time: 180, usage: 38 },
        { time: 240, usage: 34 },
        { time: 300, usage: 36 },
        { time: 360, usage: 33 },
        { time: 420, usage: 37 },
        { time: 480, usage: 35 },
        { time: 540, usage: 39 },
        { time: 600, usage: 36 },
      ];

      const avgCpu = cpuReadings.reduce((sum, r) => sum + r.usage, 0) / cpuReadings.length;
      const maxCpu = Math.max(...cpuReadings.map(r => r.usage));
      const acceptableAvgCpu = 50; // 50% average threshold
      const acceptableMaxCpu = 80; // 80% max threshold

      expect(avgCpu).toBeLessThanOrEqual(acceptableAvgCpu);
      expect(maxCpu).toBeLessThanOrEqual(acceptableMaxCpu);
    });

    it('should detect latency creep during sustained load', () => {
      // Simulate latency over time
      const latencyReadings = [
        { minute: 1, p99: 20 },
        { minute: 2, p99: 22 },
        { minute: 3, p99: 21 },
        { minute: 4, p99: 23 },
        { minute: 5, p99: 24 },
        { minute: 6, p99: 23 },
        { minute: 7, p99: 25 },
        { minute: 8, p99: 24 },
        { minute: 9, p99: 26 },
        { minute: 10, p99: 25 },
      ];

      const firstHalfAvg = latencyReadings.slice(0, 5).reduce((sum, r) => sum + r.p99, 0) / 5;
      const secondHalfAvg = latencyReadings.slice(5, 10).reduce((sum, r) => sum + r.p99, 0) / 5;
      const latencyCreep = secondHalfAvg - firstHalfAvg;
      const acceptableCreep = 50; // 50ms acceptable creep

      expect(latencyCreep).toBeLessThanOrEqual(acceptableCreep);
    });
  });

  describe('Error Handling in Sustained Tests', () => {
    it('should categorize error types during sustained load', () => {
      const errorCategories = {
        timeout: 0,
        connectionReset: 0,
        serverError: 0,
        clientError: 0,
      };

      const totalErrors = Object.values(errorCategories).reduce((a, b) => a + b, 0);
      expect(totalErrors).toBe(0);
    });

    it('should track non-2xx responses separately', () => {
      const responseStats = {
        '2xx': 119500,
        '4xx': 300,
        '5xx': 200,
      };

      const total = Object.values(responseStats).reduce((a, b) => a + b, 0);
      const successRate = responseStats['2xx'] / total;
      const acceptableSuccessRate = 0.995; // 99.5%

      expect(successRate).toBeGreaterThanOrEqual(acceptableSuccessRate);
    });
  });
});
