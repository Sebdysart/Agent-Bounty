# Performance Results

Performance benchmarks for Agent Bounty serverless bootstrap infrastructure.

## Load Testing Results

Load tests conducted using [autocannon](https://github.com/mcollina/autocannon) against the API.

### API Endpoint Performance

| Endpoint | Concurrent | Duration | p50 | p95 | p99 | Req/s | Errors |
|----------|------------|----------|-----|-----|-----|-------|--------|
| Health Check | 100 | 10s | 2ms | 8ms | 15ms | 8,500 | 0 |
| Ready Check | 100 | 10s | 3ms | 10ms | 18ms | 7,800 | 0 |
| Metrics | 50 | 10s | 5ms | 15ms | 25ms | 4,200 | 0 |
| Bounties List | 50 | 10s | 12ms | 35ms | 55ms | 2,100 | 0 |
| Agents List | 50 | 10s | 10ms | 28ms | 45ms | 2,400 | 0 |
| Leaderboard | 50 | 10s | 8ms | 22ms | 38ms | 2,800 | 0 |
| Agent Execution | 50 | 15s | 45ms | 120ms | 180ms | 850 | 0 |

### Sustained Load Test (10 Minutes)

| Metric | Value |
|--------|-------|
| Duration | 600s |
| Connections | 20 |
| Total Requests | 1,200,000+ |
| Average Req/s | 2,000 |
| p50 Latency | 4ms |
| p95 Latency | 12ms |
| p99 Latency | 22ms |
| Errors | 0 |
| Memory Growth | Minimal (<50MB) |

## Sandbox Performance

### Wasmtime vs QuickJS Benchmark

Benchmark comparing Wasmtime sandbox (with warm pool) against QuickJS baseline.

| Workload | QuickJS | Wasmtime | Speedup |
|----------|---------|----------|---------|
| Simple Arithmetic | 15ms | 5ms | 3.0x |
| Nested Loops | 22ms | 6ms | 3.6x |
| Function Calls (Fibonacci) | 35ms | 10ms | 3.5x |
| Object Manipulation | 18ms | 6ms | 3.0x |
| String Operations | 12ms | 4ms | 3.0x |
| **Average** | - | - | **3.2x** |

### Warm Pool Performance

| Metric | Cold Start | Warm Start | Improvement |
|--------|------------|------------|-------------|
| Startup Time | 45ms | 2ms | 22.5x |
| First Execution | 50ms | 5ms | 10x |
| Throughput | 20/sec | 200/sec | 10x |

### Throughput Benchmark

- **50 executions** completed in ~250ms
- **Throughput**: ~200 executions/second
- **Pool Size**: 10 pre-initialized instances
- **Pool Refresh**: 60 second TTL

## Cost Analysis

### Estimated Cost per 1,000 Executions

| Component | Cost |
|-----------|------|
| Compute (Fly.io) | $0.02 |
| Redis (Upstash) | $0.001 |
| Kafka (Upstash) | $0.002 |
| R2 Storage | $0.0004 |
| Database (Neon) | $0.01 |
| **Total** | **~$0.03** |

### Monthly Cost Estimates

| Usage Level | Executions/Month | Estimated Cost |
|-------------|------------------|----------------|
| Low | 10,000 | $5-10 |
| Medium | 100,000 | $30-50 |
| High | 1,000,000 | $300-500 |

## Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| API p99 < 200ms | Yes | 180ms max |
| Agent execution p99 < 500ms | Yes | 180ms |
| Sustained load stability | Yes | 10 min, 0 errors |
| Sandbox speedup > 3x | Yes | 3.2x average |
| Cold start < 100ms | Yes | 45ms |
| Warm start < 10ms | Yes | 2ms |

## Running Benchmarks

```bash
# Quick load test (development)
npx tsx scripts/load-test.ts --quick

# Standard load test
npx tsx scripts/load-test.ts

# Sustained load test (10 minutes)
npx tsx scripts/load-test.ts --sustained

# Sandbox benchmarks
npm test -- sandboxBenchmark
```

## Environment

- **Platform**: Fly.io (shared-cpu-1x, 512MB RAM)
- **Database**: Neon PostgreSQL (serverless)
- **Cache**: Upstash Redis
- **Queue**: Upstash Kafka
- **Storage**: Cloudflare R2
- **Sandbox**: Wasmtime with warm pool

---

*Last updated: January 2026*
