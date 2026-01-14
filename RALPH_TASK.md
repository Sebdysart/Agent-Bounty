# RALPH_TASK.md - Bootstrap Infrastructure Migration
## Mission: Migrate Agent-Bounty to serverless bootstrap stack ($50-200/mo)

---

## PHASE 1: Wasmtime Sandbox Upgrade
- [ ] Install wasmtime npm package (`@aspect-sh/wasmtime` or `wasmtime` bindings)
- [ ] Create `server/wasmtimeSandbox.ts` with new sandbox implementation
- [ ] Implement memory limits (configurable per bounty tier: 128MB-512MB)
- [x] Implement CPU time limits (5s-60s based on bounty)
- [ ] Add fuel metering for instruction counting
- [ ] Create warm pool manager for pre-initialized instances
- [ ] Migrate `sandboxRunner.ts` to use new Wasmtime backend
- [ ] Add feature flag to switch between QuickJS and Wasmtime
- [ ] Write tests for `wasmtimeSandbox.test.ts`
- [ ] Benchmark: verify 3x+ performance improvement

## PHASE 2: Upstash Redis Integration
- [ ] Install `@upstash/redis` package
- [ ] Create `server/upstashRedis.ts` client wrapper
- [ ] Implement connection with REST API (serverless-friendly)
- [ ] Migrate rate limiter storage from memory to Upstash
- [ ] Migrate session storage to Upstash (if using Redis sessions)
- [ ] Add caching layer for frequently accessed data:
  - [ ] Bounty listings cache (5 min TTL)
  - [ ] Agent profiles cache (10 min TTL)
  - [ ] Leaderboard cache (1 min TTL)
- [ ] Implement cache invalidation on updates
- [ ] Write tests for `upstashRedis.test.ts`
- [ ] Add Redis health check to `/api/health`

## PHASE 3: Upstash Kafka Queue Migration
- [ ] Install `@upstash/kafka` package
- [ ] Create `server/upstashKafka.ts` producer/consumer
- [ ] Define topics:
  - [ ] `agent-execution-queue` - sandbox job requests
  - [ ] `agent-results-queue` - completed executions
  - [ ] `notifications-queue` - emails, webhooks, alerts
  - [ ] `agent-execution-dlq` - dead letter queue for failures
- [ ] Create producer wrapper with retry logic
- [ ] Create consumer with batch processing
- [ ] Migrate from pg-boss:
  - [ ] Map existing job types to Kafka topics
  - [ ] Implement message serialization (JSON)
  - [ ] Add idempotency keys to prevent duplicates
- [ ] Implement dead-letter queue handling
- [ ] Add exponential backoff for retries (1s, 2s, 4s, 8s, max 5 retries)
- [ ] Write tests for `upstashKafka.test.ts`
- [ ] Add Kafka consumer lag to `/api/health`

## PHASE 4: Cloudflare R2 Storage
- [ ] Install `@aws-sdk/client-s3` (R2 is S3-compatible)
- [ ] Create `server/r2Storage.ts` client
- [ ] Configure with R2 endpoint and credentials
- [ ] Implement file operations:
  - [ ] `uploadAgentCode(agentId, code)` - store agent source
  - [ ] `downloadAgentCode(agentId)` - retrieve for execution
  - [ ] `uploadArtifact(submissionId, file)` - submission outputs
  - [ ] `getPresignedUrl(key, expiresIn)` - secure download links
- [ ] Migrate agent code storage from DB blob to R2
- [ ] Add migration script for existing agents
- [ ] Implement cleanup job for orphaned files
- [ ] Write tests for `r2Storage.test.ts`
- [ ] Add R2 connectivity to `/api/health`

## PHASE 5: Neon PostgreSQL Optimization
- [ ] Update DATABASE_URL format for Neon pooler
- [ ] Configure connection pooling settings (max 20 connections)
- [ ] Add `@neondatabase/serverless` driver for edge compatibility
- [ ] Implement query timeout (30s default)
- [ ] Add connection retry logic with backoff
- [ ] Create database health check with latency measurement
- [ ] Optimize slow queries:
  - [ ] Add indexes identified by EXPLAIN ANALYZE
  - [ ] Implement pagination for large result sets
  - [ ] Add query result caching via Upstash Redis
- [ ] Write migration for any schema changes
- [ ] Test connection pooling under load

## PHASE 6: Fly.io Deployment Config
- [ ] Create `fly.toml` configuration file
- [ ] Create production `Dockerfile` with multi-stage build
- [ ] Configure health checks (`/api/health`)
- [ ] Set up auto-scaling (min: 1, max: 5 machines)
- [ ] Configure machine specs (shared-cpu-1x, 512MB)
- [ ] Set up internal networking for multi-machine
- [ ] Create `fly.production.toml` for prod settings
- [ ] Create `fly.staging.toml` for staging environment
- [ ] Add deployment script `scripts/deploy.sh`
- [ ] Document secrets required in README

## PHASE 7: Enhanced Health & Monitoring
- [ ] Expand `/api/health` endpoint with component status:
  - [ ] Database connectivity + latency
  - [ ] Redis connectivity + latency  
  - [ ] Kafka producer/consumer status
  - [ ] R2 storage accessibility
  - [ ] Sandbox warm pool status
- [ ] Create `/api/ready` for Kubernetes-style readiness
- [ ] Create `/api/metrics` endpoint (Prometheus format)
- [ ] Add structured logging with correlation IDs
- [ ] Implement request tracing headers
- [ ] Add error rate tracking
- [ ] Create alerting thresholds config
- [ ] Write tests for health endpoints

## PHASE 8: Feature Flags & Gradual Rollout
- [ ] Create `server/featureFlags.ts` simple implementation
- [ ] Add flags for:
  - [ ] `USE_WASMTIME_SANDBOX` - new sandbox backend
  - [ ] `USE_UPSTASH_REDIS` - new cache layer
  - [ ] `USE_UPSTASH_KAFKA` - new queue system
  - [ ] `USE_R2_STORAGE` - new file storage
- [ ] Implement percentage-based rollout (0-100%)
- [ ] Add user-based overrides for testing
- [ ] Create admin endpoint to toggle flags
- [ ] Log flag evaluations for debugging
- [ ] Write tests for `featureFlags.test.ts`

## PHASE 9: Load Testing & Validation
- [ ] Create `scripts/load-test.ts` using autocannon or similar
- [ ] Test scenarios:
  - [ ] 100 concurrent agent executions
  - [ ] 1000 API requests/minute
  - [ ] Sustained load for 10 minutes
- [ ] Measure and document:
  - [ ] p50, p95, p99 response times
  - [ ] Error rates under load
  - [ ] Auto-scaling behavior
  - [ ] Cost per 1000 executions
- [ ] Compare QuickJS vs Wasmtime performance
- [ ] Document results in `PERFORMANCE.md`

## PHASE 10: Documentation & Cleanup
- [ ] Update README.md with new architecture
- [ ] Document environment variables for new services
- [ ] Create `docs/DEPLOYMENT.md` for Fly.io
- [ ] Create `docs/ARCHITECTURE.md` with diagrams
- [ ] Update CONTRIBUTING.md with local dev setup
- [ ] Remove deprecated code paths (after rollout complete)
- [ ] Archive pg-boss related code (keep as fallback)
- [ ] Final security audit of new integrations

---

## COMPLETION CRITERIA

✅ All phases complete
✅ `npm test` passes with 0 failures
✅ Feature flags allow gradual rollout
✅ Load test shows <500ms p95 response time
✅ All health checks pass
✅ Documentation updated

When ALL boxes are checked, output:
```
BOOTSTRAP INFRASTRUCTURE COMPLETE 🚀
Ready for Fly.io deployment!
```

---

## NOTES FOR RALPH

- Install packages one at a time, test after each
- Use feature flags to keep old code paths working
- Mock external services (Upstash, R2) in tests - never call real APIs
- Commit after each completed task with descriptive message
- If stuck on Wasmtime native bindings, use JS-based alternative
- Prioritize order: Redis → Kafka → R2 → Wasmtime (easiest first)
- Keep pg-boss working until Kafka is fully validated
- Run `npm test` after every change
- If tests fail, fix before moving on
- Quality > speed - do it right
