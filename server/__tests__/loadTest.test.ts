/**
 * Tests for Load Testing Suite utility functions
 * Mocks autocannon to avoid actual load testing during unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Result as AutocannonResult } from 'autocannon';

// Mock autocannon
const mockAutocannon = vi.fn();
vi.mock('autocannon', () => ({
  default: mockAutocannon,
}));

// Import after mocking
import { parseResult, LoadTestConfig, TestResult } from '../../scripts/load-test';

describe('Load Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('parseResult', () => {
    it('should parse autocannon result correctly', () => {
      const mockResult: AutocannonResult = {
        title: 'Test',
        url: 'http://localhost:5000/api/health',
        socketPath: undefined,
        connections: 10,
        sampleInt: 1,
        pipelining: 1,
        workers: undefined,
        duration: 10,
        samples: 10,
        start: new Date(),
        finish: new Date(),
        errors: 0,
        timeouts: 0,
        mismatches: 0,
        non2xx: 0,
        resets: 0,
        '1xx': 0,
        '2xx': 1000,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
        statusCodeStats: {},
        latency: {
          average: 5.5,
          mean: 5.5,
          stddev: 1.2,
          min: 1,
          max: 25,
          p0_001: 1,
          p0_01: 1,
          p0_1: 2,
          p1: 2,
          p2_5: 3,
          p10: 3,
          p25: 4,
          p50: 5,
          p75: 6,
          p90: 8,
          p97_5: 12,
          p99: 15,
          p99_9: 20,
          p99_99: 23,
          p99_999: 25,
          totalCount: 1000,
        },
        requests: {
          average: 100,
          mean: 100,
          stddev: 5,
          min: 90,
          max: 110,
          total: 1000,
          p0_001: 90,
          p0_01: 90,
          p0_1: 92,
          p1: 93,
          p2_5: 94,
          p10: 95,
          p25: 97,
          p50: 100,
          p75: 103,
          p90: 105,
          p97_5: 108,
          p99: 109,
          p99_9: 110,
          p99_99: 110,
          p99_999: 110,
          sent: 1000,
          totalCount: 10,
        },
        throughput: {
          average: 50000,
          mean: 50000,
          stddev: 2000,
          min: 45000,
          max: 55000,
          total: 500000,
          p0_001: 45000,
          p0_01: 45000,
          p0_1: 46000,
          p1: 46500,
          p2_5: 47000,
          p10: 47500,
          p25: 48500,
          p50: 50000,
          p75: 51500,
          p90: 53000,
          p97_5: 54000,
          p99: 54500,
          p99_9: 55000,
          p99_99: 55000,
          p99_999: 55000,
          totalCount: 10,
        },
      };

      const result = parseResult('Test Load', mockResult);

      expect(result.name).toBe('Test Load');
      expect(result.latency.p50).toBe(5);
      expect(result.latency.p95).toBeUndefined(); // p95 is not in the standard result
      expect(result.latency.p99).toBe(15);
      expect(result.latency.avg).toBe(5.5);
      expect(result.latency.max).toBe(25);
      expect(result.requests.total).toBe(1000);
      expect(result.requests.average).toBe(100);
      expect(result.requests.sent).toBe(1000);
      expect(result.throughput.average).toBe(50000);
      expect(result.throughput.total).toBe(500000);
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.duration).toBe(10);
    });

    it('should handle result with errors', () => {
      const mockResult: AutocannonResult = {
        title: 'Test with errors',
        url: 'http://localhost:5000/api/health',
        socketPath: undefined,
        connections: 10,
        sampleInt: 1,
        pipelining: 1,
        workers: undefined,
        duration: 10,
        samples: 10,
        start: new Date(),
        finish: new Date(),
        errors: 5,
        timeouts: 2,
        mismatches: 0,
        non2xx: 7,
        resets: 0,
        '1xx': 0,
        '2xx': 993,
        '3xx': 0,
        '4xx': 5,
        '5xx': 2,
        statusCodeStats: {},
        latency: {
          average: 10,
          mean: 10,
          stddev: 5,
          min: 2,
          max: 100,
          p0_001: 2,
          p0_01: 2,
          p0_1: 3,
          p1: 4,
          p2_5: 5,
          p10: 6,
          p25: 7,
          p50: 8,
          p75: 12,
          p90: 20,
          p97_5: 50,
          p99: 80,
          p99_9: 95,
          p99_99: 99,
          p99_999: 100,
          totalCount: 1000,
        },
        requests: {
          average: 100,
          mean: 100,
          stddev: 10,
          min: 80,
          max: 120,
          total: 1000,
          p0_001: 80,
          p0_01: 80,
          p0_1: 82,
          p1: 85,
          p2_5: 87,
          p10: 90,
          p25: 95,
          p50: 100,
          p75: 105,
          p90: 110,
          p97_5: 115,
          p99: 118,
          p99_9: 120,
          p99_99: 120,
          p99_999: 120,
          sent: 1000,
          totalCount: 10,
        },
        throughput: {
          average: 50000,
          mean: 50000,
          stddev: 5000,
          min: 40000,
          max: 60000,
          total: 500000,
          p0_001: 40000,
          p0_01: 40000,
          p0_1: 42000,
          p1: 43000,
          p2_5: 44000,
          p10: 45000,
          p25: 47000,
          p50: 50000,
          p75: 53000,
          p90: 55000,
          p97_5: 58000,
          p99: 59000,
          p99_9: 60000,
          p99_99: 60000,
          p99_999: 60000,
          totalCount: 10,
        },
      };

      const result = parseResult('Error Test', mockResult);

      expect(result.name).toBe('Error Test');
      expect(result.errors).toBe(5);
      expect(result.timeouts).toBe(2);
    });
  });

  describe('LoadTestConfig interface', () => {
    it('should allow minimal configuration', () => {
      const config: LoadTestConfig = {
        name: 'Simple Test',
        url: 'http://localhost:5000/api/health',
        connections: 10,
        duration: 5,
      };

      expect(config.name).toBe('Simple Test');
      expect(config.url).toBe('http://localhost:5000/api/health');
      expect(config.connections).toBe(10);
      expect(config.duration).toBe(5);
      expect(config.method).toBeUndefined();
      expect(config.pipelining).toBeUndefined();
    });

    it('should allow full configuration', () => {
      const config: LoadTestConfig = {
        name: 'Full Test',
        url: 'http://localhost:5000/api/bounties',
        method: 'POST',
        connections: 50,
        duration: 30,
        pipelining: 10,
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
      };

      expect(config.method).toBe('POST');
      expect(config.pipelining).toBe(10);
      expect(config.body).toBe('{"test":"data"}');
      expect(config.headers?.['Content-Type']).toBe('application/json');
    });
  });

  describe('TestResult interface', () => {
    it('should have correct structure', () => {
      const result: TestResult = {
        name: 'Test Result',
        latency: {
          p50: 5,
          p95: 10,
          p99: 15,
          avg: 6,
          max: 25,
        },
        requests: {
          total: 1000,
          average: 100,
          sent: 1000,
        },
        throughput: {
          average: 50000,
          total: 500000,
        },
        errors: 0,
        timeouts: 0,
        duration: 10,
      };

      expect(result.latency.p50).toBe(5);
      expect(result.latency.p95).toBe(10);
      expect(result.latency.p99).toBe(15);
      expect(result.requests.total).toBe(1000);
      expect(result.throughput.total).toBe(500000);
    });
  });

  describe('100 Concurrent API Requests Test', () => {
    it('should configure 100 concurrent connections correctly', () => {
      const config: LoadTestConfig = {
        name: '100 Concurrent API Requests',
        url: 'http://localhost:5000/api/health',
        connections: 100,
        duration: 10,
      };

      expect(config.connections).toBe(100);
      expect(config.name).toBe('100 Concurrent API Requests');
    });

    it('should parse results from 100 concurrent requests correctly', () => {
      const mockResult: AutocannonResult = {
        title: '100 Concurrent Test',
        url: 'http://localhost:5000/api/health',
        socketPath: undefined,
        connections: 100,
        sampleInt: 1,
        pipelining: 1,
        workers: undefined,
        duration: 10,
        samples: 10,
        start: new Date(),
        finish: new Date(),
        errors: 0,
        timeouts: 0,
        mismatches: 0,
        non2xx: 0,
        resets: 0,
        '1xx': 0,
        '2xx': 10000,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
        statusCodeStats: {},
        latency: {
          average: 8.5,
          mean: 8.5,
          stddev: 2.5,
          min: 2,
          max: 50,
          p0_001: 2,
          p0_01: 2,
          p0_1: 3,
          p1: 4,
          p2_5: 5,
          p10: 5,
          p25: 6,
          p50: 8,
          p75: 10,
          p90: 12,
          p97_5: 18,
          p99: 25,
          p99_9: 40,
          p99_99: 48,
          p99_999: 50,
          totalCount: 10000,
        },
        requests: {
          average: 1000,
          mean: 1000,
          stddev: 50,
          min: 900,
          max: 1100,
          total: 10000,
          p0_001: 900,
          p0_01: 900,
          p0_1: 920,
          p1: 930,
          p2_5: 940,
          p10: 950,
          p25: 970,
          p50: 1000,
          p75: 1030,
          p90: 1050,
          p97_5: 1080,
          p99: 1090,
          p99_9: 1100,
          p99_99: 1100,
          p99_999: 1100,
          sent: 10000,
          totalCount: 10,
        },
        throughput: {
          average: 500000,
          mean: 500000,
          stddev: 20000,
          min: 450000,
          max: 550000,
          total: 5000000,
          p0_001: 450000,
          p0_01: 450000,
          p0_1: 460000,
          p1: 465000,
          p2_5: 470000,
          p10: 475000,
          p25: 485000,
          p50: 500000,
          p75: 515000,
          p90: 530000,
          p97_5: 540000,
          p99: 545000,
          p99_9: 550000,
          p99_99: 550000,
          p99_999: 550000,
          totalCount: 10,
        },
      };

      const result = parseResult('100 Concurrent API Requests', mockResult);

      expect(result.name).toBe('100 Concurrent API Requests');
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.requests.total).toBe(10000);
      expect(result.latency.p50).toBe(8);
      expect(result.latency.p99).toBe(25);
      expect(result.latency.max).toBe(50);
    });

    it('should handle 100 concurrent requests with some errors', () => {
      const mockResult: AutocannonResult = {
        title: '100 Concurrent with Errors',
        url: 'http://localhost:5000/api/health',
        socketPath: undefined,
        connections: 100,
        sampleInt: 1,
        pipelining: 1,
        workers: undefined,
        duration: 10,
        samples: 10,
        start: new Date(),
        finish: new Date(),
        errors: 10,
        timeouts: 5,
        mismatches: 0,
        non2xx: 15,
        resets: 0,
        '1xx': 0,
        '2xx': 9985,
        '3xx': 0,
        '4xx': 10,
        '5xx': 5,
        statusCodeStats: {},
        latency: {
          average: 15,
          mean: 15,
          stddev: 10,
          min: 5,
          max: 200,
          p0_001: 5,
          p0_01: 5,
          p0_1: 6,
          p1: 7,
          p2_5: 8,
          p10: 9,
          p25: 10,
          p50: 12,
          p75: 18,
          p90: 30,
          p97_5: 80,
          p99: 150,
          p99_9: 180,
          p99_99: 195,
          p99_999: 200,
          totalCount: 10000,
        },
        requests: {
          average: 1000,
          mean: 1000,
          stddev: 100,
          min: 800,
          max: 1200,
          total: 10000,
          p0_001: 800,
          p0_01: 800,
          p0_1: 850,
          p1: 870,
          p2_5: 890,
          p10: 900,
          p25: 950,
          p50: 1000,
          p75: 1050,
          p90: 1100,
          p97_5: 1150,
          p99: 1180,
          p99_9: 1200,
          p99_99: 1200,
          p99_999: 1200,
          sent: 10000,
          totalCount: 10,
        },
        throughput: {
          average: 500000,
          mean: 500000,
          stddev: 50000,
          min: 400000,
          max: 600000,
          total: 5000000,
          p0_001: 400000,
          p0_01: 400000,
          p0_1: 420000,
          p1: 430000,
          p2_5: 440000,
          p10: 450000,
          p25: 470000,
          p50: 500000,
          p75: 530000,
          p90: 550000,
          p97_5: 580000,
          p99: 590000,
          p99_9: 600000,
          p99_99: 600000,
          p99_999: 600000,
          totalCount: 10,
        },
      };

      const result = parseResult('100 Concurrent with Errors', mockResult);

      expect(result.name).toBe('100 Concurrent with Errors');
      expect(result.errors).toBe(10);
      expect(result.timeouts).toBe(5);
      expect(result.latency.max).toBe(200);
    });
  });
});
