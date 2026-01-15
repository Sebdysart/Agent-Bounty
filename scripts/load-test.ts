/**
 * Load Testing Suite for Agent Bounty API
 *
 * Tests API performance under various load conditions using autocannon.
 * Run with: npx tsx scripts/load-test.ts
 */

import autocannon, { Result as AutocannonResult } from 'autocannon';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface LoadTestConfig {
  name: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  connections: number;
  duration: number; // seconds
  pipelining?: number;
  body?: string;
  headers?: Record<string, string>;
}

interface TestResult {
  name: string;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
  };
  requests: {
    total: number;
    average: number;
    sent: number;
  };
  throughput: {
    average: number;
    total: number;
  };
  errors: number;
  timeouts: number;
  duration: number;
}

function parseResult(name: string, result: AutocannonResult): TestResult {
  return {
    name,
    latency: {
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
      avg: result.latency.average,
      max: result.latency.max,
    },
    requests: {
      total: result.requests.total,
      average: result.requests.average,
      sent: result.requests.sent,
    },
    throughput: {
      average: result.throughput.average,
      total: result.throughput.total,
    },
    errors: result.errors,
    timeouts: result.timeouts,
    duration: result.duration,
  };
}

async function runLoadTest(config: LoadTestConfig): Promise<TestResult> {
  console.log(`\n Running: ${config.name}`);
  console.log(`   URL: ${config.url}`);
  console.log(`   Connections: ${config.connections}`);
  console.log(`   Duration: ${config.duration}s`);

  const result = await autocannon({
    url: config.url,
    method: config.method || 'GET',
    connections: config.connections,
    duration: config.duration,
    pipelining: config.pipelining || 1,
    body: config.body,
    headers: config.headers,
  });

  return parseResult(config.name, result);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function printResult(result: TestResult): void {
  console.log(`\n ${result.name}`);
  console.log('   Latency:');
  console.log(`     p50: ${result.latency.p50}ms`);
  console.log(`     p95: ${result.latency.p95}ms`);
  console.log(`     p99: ${result.latency.p99}ms`);
  console.log(`     avg: ${result.latency.avg.toFixed(2)}ms`);
  console.log(`     max: ${result.latency.max}ms`);
  console.log('   Requests:');
  console.log(`     total: ${result.requests.total}`);
  console.log(`     avg/sec: ${result.requests.average.toFixed(2)}`);
  console.log('   Throughput:');
  console.log(`     avg: ${formatBytes(result.throughput.average)}/sec`);
  console.log(`     total: ${formatBytes(result.throughput.total)}`);
  console.log(`   Errors: ${result.errors}`);
  console.log(`   Timeouts: ${result.timeouts}`);
}

function printSummary(results: TestResult[]): void {
  console.log('\n');
  console.log('='.repeat(60));
  console.log(' LOAD TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('\n| Test | p50 | p95 | p99 | Req/s | Errors |');
  console.log('|------|-----|-----|-----|-------|--------|');

  for (const r of results) {
    const name = r.name.length > 30 ? r.name.substring(0, 27) + '...' : r.name.padEnd(30);
    console.log(
      `| ${name} | ${r.latency.p50}ms | ${r.latency.p95}ms | ${r.latency.p99}ms | ${r.requests.average.toFixed(0)} | ${r.errors} |`
    );
  }

  console.log('\n');

  // Performance assessment
  const failedTests = results.filter(r => r.errors > 0 || r.latency.p99 > 1000);
  if (failedTests.length === 0) {
    console.log(' All tests passed performance criteria');
  } else {
    console.log(' Tests with issues:');
    for (const t of failedTests) {
      const issues = [];
      if (t.errors > 0) issues.push(`${t.errors} errors`);
      if (t.latency.p99 > 1000) issues.push(`p99 > 1000ms (${t.latency.p99}ms)`);
      console.log(`   - ${t.name}: ${issues.join(', ')}`);
    }
  }
}

// Test configurations
const tests: LoadTestConfig[] = [
  // Health endpoint - lightweight, should handle high load
  {
    name: 'Health Check (100 concurrent)',
    url: `${BASE_URL}/api/health`,
    connections: 100,
    duration: 10,
  },
  {
    name: 'Ready Check (100 concurrent)',
    url: `${BASE_URL}/api/ready`,
    connections: 100,
    duration: 10,
  },
  {
    name: 'Metrics Endpoint (50 concurrent)',
    url: `${BASE_URL}/api/metrics`,
    connections: 50,
    duration: 10,
  },
  // API endpoints
  {
    name: 'Bounties List (50 concurrent)',
    url: `${BASE_URL}/api/bounties`,
    connections: 50,
    duration: 10,
  },
  {
    name: 'Agents List (50 concurrent)',
    url: `${BASE_URL}/api/agents`,
    connections: 50,
    duration: 10,
  },
  {
    name: 'Leaderboard (50 concurrent)',
    url: `${BASE_URL}/api/leaderboard`,
    connections: 50,
    duration: 10,
  },
  // Sustained load test - 10 minutes (600 seconds)
  {
    name: 'Health Check (Sustained 10min)',
    url: `${BASE_URL}/api/health`,
    connections: 20,
    duration: 600,
  },
];

// Quick test mode for CI/development
const quickTests: LoadTestConfig[] = [
  {
    name: 'Health Check Quick',
    url: `${BASE_URL}/api/health`,
    connections: 10,
    duration: 5,
  },
  {
    name: 'Ready Check Quick',
    url: `${BASE_URL}/api/ready`,
    connections: 10,
    duration: 5,
  },
  {
    name: 'Metrics Quick',
    url: `${BASE_URL}/api/metrics`,
    connections: 10,
    duration: 5,
  },
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick') || args.includes('-q');
  const isSustained = args.includes('--sustained') || args.includes('-s');
  const testTarget = args.find(a => a.startsWith('--target='))?.split('=')[1];

  console.log('='.repeat(60));
  console.log(' Agent Bounty Load Testing Suite');
  console.log('='.repeat(60));
  console.log(`\n Base URL: ${BASE_URL}`);
  console.log(` Mode: ${isQuick ? 'Quick' : isSustained ? 'Sustained (10min)' : 'Standard'}`);
  console.log(` Time: ${new Date().toISOString()}`);

  // Check if server is reachable
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (!response.ok) {
      console.error(`\n Server returned ${response.status}. Make sure the server is running.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n Cannot reach server at ${BASE_URL}. Make sure the server is running.`);
    process.exit(1);
  }

  let testsToRun: LoadTestConfig[];

  if (testTarget) {
    // Run specific test
    testsToRun = tests.filter(t => t.name.toLowerCase().includes(testTarget.toLowerCase()));
    if (testsToRun.length === 0) {
      console.error(`\n No tests found matching: ${testTarget}`);
      process.exit(1);
    }
  } else if (isQuick) {
    testsToRun = quickTests;
  } else if (isSustained) {
    testsToRun = tests.filter(t => t.name.includes('Sustained'));
  } else {
    // Standard mode: exclude sustained tests
    testsToRun = tests.filter(t => !t.name.includes('Sustained'));
  }

  console.log(`\n Running ${testsToRun.length} test(s)...\n`);

  const results: TestResult[] = [];

  for (const test of testsToRun) {
    try {
      const result = await runLoadTest(test);
      printResult(result);
      results.push(result);
    } catch (error) {
      console.error(`\n Error running test "${test.name}":`, error);
    }
  }

  printSummary(results);

  // Exit with error if any tests had errors
  const hasErrors = results.some(r => r.errors > 0);
  process.exit(hasErrors ? 1 : 0);
}

// Export for testing
export { runLoadTest, parseResult, LoadTestConfig, TestResult };

// Run if called directly
main().catch(console.error);
