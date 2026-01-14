# 🎯 RALPH TASK: Make Agent-Bounty BULLETPROOF

> Mission: Production-ready platform with comprehensive tests, security hardening, and zero gaps.
> Model: Claude Sonnet 4.5
> Completion: All checkboxes must be [x] before outputting `<promise>DONE</promise>`

---

## PHASE 1: Test Infrastructure Setup
- [x] Create `vitest.config.ts` with TypeScript and path aliases support
- [x] Create `server/__tests__/setup.ts` with global test utilities
- [x] Create `server/__tests__/mocks/database.ts` - mock Drizzle DB
- [x] Create `server/__tests__/mocks/stripe.ts` - mock Stripe client
- [x] Create `server/__tests__/mocks/openai.ts` - mock OpenAI client
- [x] Create `server/__tests__/factories/index.ts` - entity factories (User, Bounty, Agent, Submission)
- [x] Update `package.json` with test scripts: "test", "test:watch", "test:coverage", "test:ci"
- [x] Run `npm test` and verify setup works with a simple passing test

## PHASE 2: Payment System Tests (CRITICAL - Stripe Escrow)
- [x] Create `server/__tests__/stripeService.test.ts`
- [x] Test: createCustomer creates Stripe customer with metadata
- [x] Test: createPaymentIntent sets manual capture for escrow
- [x] Test: createCheckoutSession includes bounty metadata
- [x] Test: capturePayment releases held funds
- [x] Test: refundPayment returns funds to customer
- [x] Test: createTransfer sends funds minus platform fee (15%)
- [x] Create `server/__tests__/webhookHandlers.test.ts`
- [x] Test: handleCheckoutCompleted updates bounty status to funded
- [x] Test: handleCheckoutCompleted adds timeline event
- [x] Test: handlePaymentFailed reverts to pending status
- [x] Test: handleChargeCaptured marks payment released
- [x] Test: handleChargeCaptured triggers reputation update
- [x] Test: handleChargeRefunded cancels bounty
- [x] Test: handleSubscriptionUpdated updates user tier
- [x] Test: handleSubscriptionDeleted reverts to free tier
- [x] Integration test: Full escrow lifecycle (create → fund → complete → release)

## PHASE 3: Authentication & Authorization Tests
- [x] Create `server/__tests__/authMiddleware.test.ts`
- [x] Test: validateJWT extracts payload from valid token
- [x] Test: validateJWT ignores invalid tokens gracefully
- [x] Test: requireJWT rejects requests without token (401)
- [x] Test: requireJWT rejects expired tokens (401)
- [x] Test: requireRole allows matching roles
- [x] Test: requireRole blocks non-matching roles (403)
- [x] Test: requirePermission checks RBAC correctly
- [x] Test: requireAdmin blocks non-admin users
- [x] Test: requireAdmin allows ADMIN_USER_IDS env override
- [x] Test: hybridAuth accepts session OR JWT
- [x] Create `server/__tests__/jwtService.test.ts`
- [x] Test: generateTokens creates access and refresh tokens
- [x] Test: validateAccessToken verifies signature
- [x] Test: validateRefreshToken verifies signature
- [x] Test: refreshTokens rotates tokens correctly
- [x] Test: hasPermission checks role permissions

## PHASE 4: Credential Vault Tests (SECURITY CRITICAL)
- [x] Create `server/__tests__/encryptedVault.test.ts`
- [x] Test: encrypt produces different ciphertext each time (IV randomness)
- [x] Test: decrypt recovers exact original plaintext
- [x] Test: decrypt fails on tampered ciphertext (auth tag)
- [x] Test: set persists encrypted credentials to database
- [x] Test: get retrieves and decrypts from database
- [x] Test: get returns null for expired credentials
- [x] Test: delete removes from both cache and database
- [x] Test: has returns correct boolean
- [x] Test: getMetadata returns metadata without credentials
- [x] Test: cleanup removes expired entries
- [x] Test: warmCache loads entries on startup
- [x] Test: size returns correct count

## PHASE 5: Rate Limiting Tests
- [ ] Create `server/__tests__/rateLimitMiddleware.test.ts`
- [ ] Test: apiRateLimit allows 100 requests per minute
- [ ] Test: apiRateLimit blocks request 101 with 429
- [ ] Test: apiRateLimit sets correct headers (X-RateLimit-*)
- [ ] Test: authRateLimit allows 10 requests per 15 minutes
- [ ] Test: credentialRateLimit allows 5 requests per minute
- [ ] Test: aiRateLimit allows 20 requests per minute
- [ ] Test: stripeRateLimit allows 10 requests per minute
- [ ] Test: rate limits reset after window expires
- [ ] Test: rate limits are per-user, not global

## PHASE 6: Core API Routes Tests
- [ ] Create `server/__tests__/routes/bounties.test.ts`
- [ ] Test: GET /api/bounties returns all bounties
- [ ] Test: GET /api/bounties/:id returns bounty with submissions
- [ ] Test: POST /api/bounties requires authentication
- [ ] Test: POST /api/bounties validates input with Zod
- [ ] Test: POST /api/bounties sets posterId from session
- [ ] Test: PATCH /api/bounties/:id/status requires ownership
- [ ] Test: PATCH /api/bounties/:id/status rejects non-owner (403)
- [ ] Test: POST /api/bounties/:id/fund creates checkout session
- [ ] Test: POST /api/bounties/:id/select-winner sets winner
- [ ] Test: POST /api/bounties/:id/select-winner auto-releases if requested
- [ ] Test: POST /api/bounties/:id/release-payment requires ownership
- [ ] Test: POST /api/bounties/:id/refund cancels bounty
- [ ] Create `server/__tests__/routes/agents.test.ts`
- [ ] Test: GET /api/agents returns all agents
- [ ] Test: GET /api/agents/top returns sorted by rating
- [ ] Test: GET /api/agents/mine returns user's agents only
- [ ] Test: POST /api/agents requires authentication
- [ ] Test: POST /api/agents validates input
- [ ] Create `server/__tests__/routes/submissions.test.ts`
- [ ] Test: POST /api/bounties/:id/submissions requires auth
- [ ] Test: POST /api/bounties/:id/submissions checks bounty is open
- [ ] Test: PATCH /api/submissions/:id requires agent ownership
- [ ] Test: POST /api/submissions/:id/reviews creates review
- [ ] Test: POST /api/submissions/:id/verify triggers AI verification

## PHASE 7: AI Execution Tests
- [ ] Create `server/__tests__/aiExecutionService.test.ts`
- [ ] Test: createExecutionRun creates queued run
- [ ] Test: executeRun transitions to running state
- [ ] Test: executeRun calls OpenAI with correct messages
- [ ] Test: executeRun calculates cost correctly
- [ ] Test: executeRun handles API errors gracefully
- [ ] Test: executeRun increments retry count on failure
- [ ] Test: executeAgent creates and executes in one call
- [ ] Test: getRunStatus returns run by ID
- [ ] Test: getAgentRuns returns runs for agent
- [ ] Test: getExecutionStats returns correct aggregates
- [ ] Test: cancelRun updates status to cancelled
- [ ] Create `server/__tests__/sandboxRunner.test.ts`
- [ ] Test: executeCode runs simple JavaScript
- [ ] Test: executeCode captures console.log output
- [ ] Test: executeCode captures errors
- [ ] Test: executeCode enforces timeout
- [ ] Test: executeCode rejects oversized code
- [ ] Test: executeLowCode processes step config
- [ ] Test: executeLowCode executes AI steps when configured
- [ ] Test: testSandbox returns passing result

## PHASE 8: Verification & Reputation Tests
- [ ] Create `server/__tests__/verificationService.test.ts`
- [ ] Test: createAudit creates pending audit
- [ ] Test: runAiVerification calls OpenAI for analysis
- [ ] Test: runAiVerification parses criteria checks
- [ ] Test: runAiVerification handles missing OpenAI gracefully
- [ ] Test: getAudit returns audit by ID
- [ ] Test: getSubmissionAudits returns all audits for submission
- [ ] Create `server/__tests__/reputationService.test.ts`
- [ ] Test: initializeReputation creates bronze tier
- [ ] Test: recordEvent updates scores correctly
- [ ] Test: processReview adjusts score based on rating
- [ ] Test: processBountyCompletion rewards success
- [ ] Test: processBountyCompletion penalizes failure
- [ ] Test: recalculateReputation updates tier thresholds
- [ ] Test: getAgentReputation returns full reputation

## PHASE 9: Integration Tests (End-to-End Flows)
- [ ] Create `server/__tests__/integration/bountyLifecycle.test.ts`
- [ ] Test: Complete flow: create bounty → fund → submit → verify → select winner → release payment
- [ ] Test: Cancelled flow: create bounty → fund → cancel → refund
- [ ] Test: Failed submission flow: create → fund → submit → reject → new submission
- [ ] Create `server/__tests__/integration/disputeFlow.test.ts`
- [ ] Test: Dispute flow: submission → dispute → messages → resolution
- [ ] Create `server/__tests__/integration/agentUpload.test.ts`
- [ ] Test: Agent upload: create → test → publish → marketplace listing

## PHASE 10: Security Hardening
- [ ] Add input sanitization for all user-provided HTML/text
- [ ] Add SQL injection protection verification tests
- [ ] Add XSS protection for stored content
- [ ] Add CSRF token validation for state-changing operations
- [ ] Verify all admin routes use requireAdmin middleware
- [ ] Verify all sensitive routes have rate limiting
- [ ] Add security headers middleware (helmet or custom)
- [ ] Create `server/__tests__/security.test.ts` with penetration tests

## PHASE 11: Error Handling & Logging
- [ ] Standardize error response format across all routes
- [ ] Add structured logging with request IDs
- [ ] Add error tracking integration (Sentry-ready)
- [ ] Ensure no sensitive data in error messages
- [ ] Add health check endpoint /api/health
- [ ] Add readiness check endpoint /api/ready

## PHASE 12: Documentation & DevX
- [ ] Generate OpenAPI spec from routes (swagger-jsdoc or similar)
- [ ] Add /api/docs endpoint serving Swagger UI
- [ ] Document all environment variables in .env.example
- [ ] Add CONTRIBUTING.md with test instructions
- [ ] Update README.md with architecture overview

---

## COMPLETION CRITERIA

✅ All phases complete
✅ `npm test` passes with 0 failures  
✅ `npm run test:coverage` shows >80% coverage on critical paths
✅ All security tests pass
✅ All integration tests pass

When ALL boxes are checked, output:
<promise>DONE</promise>

---

## NOTES FOR RALPH

- Use vitest for all tests (already in package.json)
- Use supertest for HTTP route testing
- Mock external services (Stripe, OpenAI) - never call real APIs
- Each test file goes next to the file it tests (e.g., `stripeService.test.ts`)
- Run tests after each change to verify
- Commit frequently with descriptive messages
- If a test is flaky, fix it before moving on
- Quality > speed - take time to do it right
