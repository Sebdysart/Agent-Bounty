# 🎯 Ralph Task: Comprehensive Test Coverage for Agent-Bounty

## Mission
Add production-grade test coverage to the AI Bounty Marketplace platform.
Target: 80%+ coverage on critical paths.

---

## Phase 1: Test Infrastructure Setup
- [ ] Install testing dependencies (vitest, supertest, @testing-library/react)
- [ ] Create vitest.config.ts with proper TypeScript support
- [ ] Create test setup file with mocks for database and external services
- [ ] Add test scripts to package.json ("test", "test:watch", "test:coverage")
- [ ] Create mock factories for User, Bounty, Agent, Submission entities

## Phase 2: Payment System Tests (Critical Path)
- [ ] Test stripeService.createCustomer()
- [ ] Test stripeService.createPaymentIntent() with escrow
- [ ] Test stripeService.capturePayment() for winner payout
- [ ] Test stripeService.refundPayment() for cancellations
- [ ] Test stripeService.createCheckoutSession()
- [ ] Test webhookHandlers.handleCheckoutCompleted()
- [ ] Test webhookHandlers.handlePaymentSucceeded()
- [ ] Test webhookHandlers.handleChargeCaptured()
- [ ] Test webhookHandlers.handleChargeRefunded()
- [ ] Test full escrow flow: create → fund → complete → release

## Phase 3: Authentication & Authorization Tests
- [ ] Test JWT token generation and validation
- [ ] Test requireJWT middleware blocks unauthorized
- [ ] Test requireRole middleware enforces roles
- [ ] Test requirePermission middleware checks RBAC
- [ ] Test hybridAuth accepts both session and JWT
- [ ] Test requireAdmin blocks non-admin users
- [ ] Test ownership verification on bounty updates
- [ ] Test ownership verification on submission updates

## Phase 4: Credential Vault Tests (Security Critical)
- [ ] Test encrypt() produces different output each time (IV randomness)
- [ ] Test decrypt() recovers original plaintext
- [ ] Test encryptedVault.set() persists to database
- [ ] Test encryptedVault.get() retrieves and decrypts
- [ ] Test encryptedVault.delete() removes credentials
- [ ] Test expired credentials are not returned
- [ ] Test cleanup() removes expired entries
- [ ] Test warmCache() loads from database on startup

## Phase 5: Core API Endpoint Tests
- [ ] Test GET /api/bounties returns list
- [ ] Test POST /api/bounties creates with validation
- [ ] Test GET /api/bounties/:id returns details + submissions
- [ ] Test PATCH /api/bounties/:id/status with ownership check
- [ ] Test POST /api/bounties/:id/fund creates checkout session
- [ ] Test POST /api/bounties/:id/select-winner updates winner
- [ ] Test POST /api/bounties/:id/release-payment captures escrow
- [ ] Test GET /api/agents returns list
- [ ] Test POST /api/agents creates with validation
- [ ] Test POST /api/bounties/:id/submissions creates submission
- [ ] Test PATCH /api/submissions/:id with agent ownership check

## Phase 6: AI Execution Tests
- [ ] Test aiExecutionService.createExecutionRun()
- [ ] Test aiExecutionService.executeRun() with mock OpenAI
- [ ] Test aiExecutionService.executeAgent() end-to-end
- [ ] Test execution fails gracefully without API key
- [ ] Test sandboxRunner.executeCode() with simple JS
- [ ] Test sandboxRunner.executeLowCode() with config
- [ ] Test sandbox enforces memory limits
- [ ] Test sandbox enforces timeout limits

## Phase 7: Rate Limiting Tests
- [ ] Test apiRateLimit allows under limit
- [ ] Test apiRateLimit blocks over limit (429)
- [ ] Test authRateLimit has stricter limits
- [ ] Test rate limit headers are set correctly
- [ ] Test rate limits reset after window expires

## Phase 8: Integration Tests
- [ ] Test complete bounty lifecycle: create → fund → submit → verify → complete → payout
- [ ] Test dispute creation and resolution flow
- [ ] Test subscription upgrade flow
- [ ] Test agent upload and publishing flow

---

## Completion Criteria
All checkboxes above must be marked [x] before outputting:
<promise>DONE</promise>

## Notes
- Use mocks for Stripe, OpenAI, and database where appropriate
- Each test file should be colocated: `service.test.ts` next to `service.ts`
- Aim for descriptive test names that document behavior
- Include both success and failure cases
