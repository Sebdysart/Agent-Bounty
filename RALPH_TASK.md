# RALPH_TASK.md - Bootstrap Infrastructure Migration
## Mission: Migrate Agent-Bounty to serverless bootstrap stack

## PHASE 1: Feature Flags Foundation
- [x] Create server/featureFlags.ts with simple flag system
- [ ] Implement in-memory flag storage with defaults
- [ ] Add flags: USE_WASMTIME_SANDBOX, USE_UPSTASH_REDIS, USE_UPSTASH_KAFKA, USE_R2_STORAGE
- [ ] Implement percentage-based rollout (0-100%)
- [ ] Add user-based overrides for testing
- [ ] Create GET /api/admin/flags to view current flags
- [ ] Create POST /api/admin/flags to toggle flags (admin only)
- [ ] Log flag evaluations for debugging
- [ ] Write tests for featureFlags.test.ts

## PHASE 2: Upstash Redis Integration
- [ ] Install @upstash/redis package
- [ ] Create server/upstashRedis.ts client wrapper
- [ ] Implement connection with REST API (serverless-friendly)
- [ ] Create interface matching existing redis usage
- [ ] Wrap with feature flag check (USE_UPSTASH_REDIS)
- [ ] Migrate rate limiter storage to use Upstash when flag enabled
- [ ] Add caching utilities (cacheGet, cacheSet, cacheInvalidate)
- [ ] Add bounty listings cache (5 min TTL)
- [ ] Add agent profiles cache (10 min TTL)
- [ ] Add leaderboard cache (1 min TTL)
- [ ] Implement cache invalidation on data updates
- [ ] Write tests for upstashRedis.test.ts (mock the API)
- [ ] Add Redis health check to /api/health

## PHASE 3: Upstash Kafka Queue Migration
- [ ] Install @upstash/kafka package
- [ ] Create server/upstashKafka.ts producer/consumer wrapper
- [ ] Define message types for topics (execution, results, notifications)
- [ ] Create KafkaProducer class with retry logic
- [ ] Create KafkaConsumer class with batch processing
- [ ] Implement dead-letter queue handler
- [ ] Add exponential backoff (1s, 2s, 4s, 8s, max 5 retries)
- [ ] Create adapter matching pg-boss interface
- [ ] Wrap with feature flag (USE_UPSTASH_KAFKA)
- [ ] Add idempotency keys to prevent duplicate processing
- [ ] Write tests for upstashKafka.test.ts (mock the API)
- [ ] Add Kafka health check to /api/health

## PHASE 4: Cloudflare R2 Storage
- [ ] Install @aws-sdk/client-s3 package (R2 is S3-compatible)
- [ ] Create server/r2Storage.ts client
- [ ] Configure S3 client with R2 endpoint format
- [ ] Implement file operations (upload, download, delete, presignedUrl, list)
- [ ] Create agent-specific helpers (uploadAgentCode, downloadAgentCode)
- [ ] Wrap with feature flag (USE_R2_STORAGE)
- [ ] Add migration utility for existing DB blobs to R2
- [ ] Implement cleanup job for orphaned files
- [ ] Write tests for r2Storage.test.ts (mock S3 client)
- [ ] Add R2 connectivity check to /api/health

## PHASE 5: Neon PostgreSQL Optimization
- [ ] Install @neondatabase/serverless driver
- [ ] Create server/neonDb.ts wrapper for serverless usage
- [ ] Configure connection pooling (max 20 connections)
- [ ] Implement query timeout wrapper (30s default)
- [ ] Add connection retry logic with exponential backoff
- [ ] Create database health check with latency measurement
- [ ] Add missing indexes for common query filters
- [ ] Implement cursor-based pagination for large results
- [ ] Integrate query caching with Upstash Redis
- [ ] Write tests for neonDb.test.ts

## PHASE 6: Wasmtime Sandbox Upgrade
- [ ] Research Wasmtime npm options (may need native bindings)
- [ ] Create server/wasmtimeSandbox.ts implementation
- [ ] Implement WASM module loading and caching
- [ ] Add memory limits (configurable: 128MB-512MB)
- [ ] Add CPU/fuel metering for time limits
- [ ] Create warm pool manager (pre-initialized instances)
- [ ] Wrap with feature flag (USE_WASMTIME_SANDBOX)
- [ ] Fallback to QuickJS if Wasmtime unavailable
- [ ] Write tests for wasmtimeSandbox.test.ts
- [ ] Benchmark QuickJS vs Wasmtime performance

## PHASE 7: Fly.io Deployment Config
- [ ] Create fly.toml with app configuration
- [ ] Create Dockerfile with multi-stage build
- [ ] Configure health check endpoint
- [ ] Set up auto-scaling (min: 1, max: 5)
- [ ] Configure machine specs (shared-cpu-1x, 512MB)
- [ ] Create fly.staging.toml for staging
- [ ] Create scripts/deploy.sh deployment script
- [ ] Create scripts/secrets.sh for managing Fly secrets
- [ ] Document all required environment variables
- [ ] Add Fly.io deployment instructions to README

## PHASE 8: Enhanced Health and Monitoring
- [ ] Expand /api/health with all component status
- [ ] Create /api/ready readiness endpoint
- [ ] Create /api/metrics Prometheus format endpoint
- [ ] Add structured logging with correlation IDs
- [ ] Implement request duration tracking middleware
- [ ] Add error rate tracking per endpoint
- [ ] Write tests for all health endpoints

## PHASE 9: Load Testing and Validation
- [ ] Install autocannon for load testing
- [ ] Create scripts/load-test.ts test suite
- [ ] Test 100 concurrent API requests
- [ ] Test 50 concurrent agent executions
- [ ] Test 10 minute sustained load
- [ ] Measure p50, p95, p99 response times
- [ ] Create PERFORMANCE.md with results
- [ ] Document cost per 1000 executions

## PHASE 10: Documentation and Finalization
- [ ] Update README.md with new architecture diagram
- [ ] Document all new environment variables
- [ ] Create docs/DEPLOYMENT.md for Fly.io guide
- [ ] Create docs/ARCHITECTURE.md with system design
- [ ] Update CONTRIBUTING.md with local dev setup
- [ ] Update .env.example with all new variables
- [ ] Final security review of all new code
- [ ] Tag release as v2.0.0-bootstrap

---

## NOTES FOR RALPH
- Run npm test after EVERY change
- Use feature flags - keep old code working
- Mock ALL external services in tests
- Commit after each completed task
- If native module issues (Wasmtime), skip and note for human
- Priority: Flags then Redis then Kafka then R2 then Neon then Fly.io then Wasmtime
- Quality over speed - passing tests required
