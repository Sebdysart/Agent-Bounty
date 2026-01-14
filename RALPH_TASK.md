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
- [x] Create `server/__tests__/rateLimitMiddleware.test.ts`
- [x] Test: apiRateLimit allows 100 requests per minute
- [x] Test: apiRateLimit blocks request 101 with 429
- [x] Test: apiRateLimit sets correct headers (X-RateLimit-*)
- [x] Test: authRateLimit allows 10 requests per 15 minutes
- [x] Test: credentialRateLimit allows 5 requests per minute
- [x] Test: aiRateLimit allows 20 requests per minute
- [x] Test: stripeRateLimit allows 10 requests per minute
- [x] Test: rate limits reset after window expires
- [x] Test: rate limits are per-user, not global

## PHASE 6: Core API Routes Tests
- [x] Create `server/__tests__/routes/bounties.test.ts`
- [x] Test: GET /api/bounties returns all bounties
- [x] Test: GET /api/bounties/:id returns bounty with submissions
- [x] Test: POST /api/bounties requires authentication
- [x] Test: POST /api/bounties validates input with Zod
- [x] Test: POST /api/bounties sets posterId from session
- [x] Test: PATCH /api/bounties/:id/status requires ownership
- [x] Test: PATCH /api/bounties/:id/status rejects non-owner (403)
- [x] Test: POST /api/bounties/:id/fund creates checkout session
- [x] Test: POST /api/bounties/:id/select-winner sets winner
- [x] Test: POST /api/bounties/:id/select-winner auto-releases if requested
- [x] Test: POST /api/bounties/:id/release-payment requires ownership
- [x] Test: POST /api/bounties/:id/refund cancels bounty
- [x] Create `server/__tests__/routes/agents.test.ts`
- [x] Test: GET /api/agents returns all agents
- [x] Test: GET /api/agents/top returns sorted by rating
- [x] Test: GET /api/agents/mine returns user's agents only
- [x] Test: POST /api/agents requires authentication
- [x] Test: POST /api/agents validates input
- [x] Create `server/__tests__/routes/submissions.test.ts`
- [x] Test: POST /api/bounties/:id/submissions requires auth
- [x] Test: POST /api/bounties/:id/submissions checks bounty is open
- [x] Test: PATCH /api/submissions/:id requires agent ownership
- [x] Test: POST /api/submissions/:id/reviews creates review
- [x] Test: POST /api/submissions/:id/verify triggers AI verification

## PHASE 7: AI Execution Tests
- [x] Create `server/__tests__/aiExecutionService.test.ts`
- [x] Test: createExecutionRun creates queued run
- [x] Test: executeRun transitions to running state
- [x] Test: executeRun calls OpenAI with correct messages
- [x] Test: executeRun calculates cost correctly
- [x] Test: executeRun handles API errors gracefully
- [x] Test: executeRun increments retry count on failure
- [x] Test: executeAgent creates and executes in one call
- [x] Test: getRunStatus returns run by ID
- [x] Test: getAgentRuns returns runs for agent
- [x] Test: getExecutionStats returns correct aggregates
- [x] Test: cancelRun updates status to cancelled
- [x] Create `server/__tests__/sandboxRunner.test.ts`
- [x] Test: executeCode runs simple JavaScript
- [x] Test: executeCode captures console.log output
- [x] Test: executeCode captures errors
- [x] Test: executeCode enforces timeout
- [x] Test: executeCode rejects oversized code
- [x] Test: executeLowCode processes step config
- [x] Test: executeLowCode executes AI steps when configured
- [x] Test: testSandbox returns passing result

## PHASE 8: Verification & Reputation Tests
- [x] Create `server/__tests__/verificationService.test.ts`
- [x] Test: createAudit creates pending audit
- [x] Test: runAiVerification calls OpenAI for analysis
- [x] Test: runAiVerification parses criteria checks
- [x] Test: runAiVerification handles missing OpenAI gracefully
- [x] Test: getAudit returns audit by ID
- [x] Test: getSubmissionAudits returns all audits for submission
- [x] Create `server/__tests__/reputationService.test.ts`
- [x] Test: initializeReputation creates bronze tier
- [x] Test: recordEvent updates scores correctly
- [x] Test: processReview adjusts score based on rating
- [x] Test: processBountyCompletion rewards success
- [x] Test: processBountyCompletion penalizes failure
- [x] Test: recalculateReputation updates tier thresholds
- [x] Test: getAgentReputation returns full reputation

## PHASE 9: Integration Tests (End-to-End Flows)
- [x] Create `server/__tests__/integration/bountyLifecycle.test.ts`
- [x] Test: Complete flow: create bounty → fund → submit → verify → select winner → release payment
- [x] Test: Cancelled flow: create bounty → fund → cancel → refund
- [x] Test: Failed submission flow: create → fund → submit → reject → new submission
- [x] Create `server/__tests__/integration/disputeFlow.test.ts`
- [x] Test: Dispute flow: submission → dispute → messages → resolution
- [x] Create `server/__tests__/integration/agentUpload.test.ts`
- [x] Test: Agent upload: create → test → publish → marketplace listing

## PHASE 10: Security Hardening
- [x] Add input sanitization for all user-provided HTML/text
- [x] Add SQL injection protection verification tests
- [x] Add XSS protection for stored content
- [x] Add CSRF token validation for state-changing operations
- [x] Verify all admin routes use requireAdmin middleware
- [x] Verify all sensitive routes have rate limiting
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
