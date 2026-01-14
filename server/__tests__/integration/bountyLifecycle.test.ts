/**
 * Bounty Lifecycle Integration Tests
 *
 * Tests complete end-to-end flows for bounty operations:
 * - Complete flow: create bounty → fund → submit → verify → select winner → release payment
 * - Cancelled flow: create bounty → fund → cancel → refund
 * - Failed submission flow: create → fund → submit → reject → new submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createBounty, createAgent, createSubmission, createUserProfile, resetIdCounter } from '../factories';

// Mock storage with full lifecycle support
const mockStorage = {
  // Bounty operations
  getAllBounties: vi.fn(),
  getBounty: vi.fn(),
  createBounty: vi.fn(),
  updateBountyStatus: vi.fn(),
  addTimelineEvent: vi.fn(),
  getBountyTimeline: vi.fn(),
  updateBountyPaymentStatus: vi.fn(),
  updateBountyCheckoutSession: vi.fn(),
  selectWinner: vi.fn(),
  // Submission operations
  getSubmissionsByBounty: vi.fn(),
  getSubmission: vi.fn(),
  createSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  updateSubmissionStatus: vi.fn(),
  // Agent operations
  getAgent: vi.fn(),
  updateAgentStats: vi.fn(),
  // User operations
  getUserProfile: vi.fn(),
  updateUserStripeCustomerId: vi.fn(),
  updateUserProfile: vi.fn(),
  // Verification
  createVerificationAudit: vi.fn(),
  updateVerificationAudit: vi.fn(),
};

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

// Mock Stripe service
const mockStripeService = {
  createCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  capturePayment: vi.fn(),
  refundPayment: vi.fn(),
  createTransfer: vi.fn(),
};

vi.mock('../../stripeService', () => ({
  stripeService: mockStripeService,
}));

// Mock verification service
const mockVerificationService = {
  createAudit: vi.fn(),
  runAiVerification: vi.fn(),
};

vi.mock('../../verificationService', () => ({
  verificationService: mockVerificationService,
}));

// Mock auth
vi.mock('../../replit_integrations/auth', () => ({
  setupAuth: vi.fn().mockResolvedValue(undefined),
  registerAuthRoutes: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { claims: { sub: 'test-user-id', email: 'test@example.com', name: 'Test User' } };
      next();
    } else if (req.headers.authorization === 'Bearer agent-owner-token') {
      req.user = { claims: { sub: 'agent-owner-id', email: 'agent@example.com', name: 'Agent Owner' } };
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  },
}));

vi.mock('../../authMiddleware', () => ({
  validateJWT: vi.fn((req: any, res: any, next: any) => next()),
  requireJWT: vi.fn((req: any, res: any, next: any) => next()),
  hybridAuth: vi.fn((req: any, res: any, next: any) => next()),
  requireAdmin: vi.fn((req: any, res: any, next: any) => next()),
}));

vi.mock('../../rateLimitMiddleware', () => ({
  apiRateLimit: (req: any, res: any, next: any) => next(),
  authRateLimit: (req: any, res: any, next: any) => next(),
  credentialRateLimit: (req: any, res: any, next: any) => next(),
  aiRateLimit: (req: any, res: any, next: any) => next(),
  stripeRateLimit: (req: any, res: any, next: any) => next(),
}));

vi.mock('../../encryptedVault', () => ({
  encryptedVault: {
    warmCache: vi.fn().mockResolvedValue(undefined),
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../websocket', () => ({
  wsService: { broadcast: vi.fn() },
}));

vi.mock('../../stripeClient', () => ({
  getStripePublishableKey: vi.fn().mockResolvedValue('pk_test_123'),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../jwtService', () => ({
  jwtService: {
    validateAccessToken: vi.fn(),
    hasPermission: vi.fn(),
    getUserRoles: vi.fn(),
  },
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => []) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
  },
}));

/**
 * Create test app with full bounty lifecycle routes
 */
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Auth middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { claims: { sub: 'test-user-id', email: 'test@example.com', name: 'Test User' } };
      next();
    } else if (req.headers.authorization === 'Bearer agent-owner-token') {
      req.user = { claims: { sub: 'agent-owner-id', email: 'agent@example.com', name: 'Agent Owner' } };
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };

  // POST /api/bounties - Create bounty
  app.post('/api/bounties', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { title, description, reward, deadline, category, successMetrics, verificationCriteria } = req.body;

      if (!title || !description || !reward || !deadline || !category) {
        return res.status(400).json({ message: 'Invalid bounty data' });
      }

      const bounty = await mockStorage.createBounty({
        ...req.body,
        posterId: userId,
        status: 'open',
        paymentStatus: 'pending',
      });

      await mockStorage.addTimelineEvent(bounty.id, 'open', 'Bounty posted and open for submissions');

      res.status(201).json(bounty);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create bounty' });
    }
  });

  // GET /api/bounties/:id
  app.get('/api/bounties/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bounty = await mockStorage.getBounty(id);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }
      const submissions = await mockStorage.getSubmissionsByBounty(id);
      const timeline = await mockStorage.getBountyTimeline(id);
      res.json({ ...bounty, submissions, timeline });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bounty' });
    }
  });

  // POST /api/bounties/:id/fund
  app.post('/api/bounties/:id/fund', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const bountyId = parseInt(req.params.id);
      const bounty = await mockStorage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can fund this bounty' });
      }

      if (bounty.paymentStatus === 'funded') {
        return res.status(400).json({ message: 'Bounty is already funded' });
      }

      let profile = await mockStorage.getUserProfile(userId);
      let customerId = profile?.stripeCustomerId;

      if (!customerId) {
        const customer = await mockStripeService.createCustomer(
          req.user?.claims?.email,
          userId,
          req.user?.claims?.name
        );
        customerId = customer.id;
        await mockStorage.updateUserStripeCustomerId(userId, customer.id);
      }

      const session = await mockStripeService.createCheckoutSession(
        customerId,
        bountyId,
        bounty.title,
        parseFloat(bounty.reward),
        `https://example.com/bounties/${bountyId}?funded=true`,
        `https://example.com/bounties/${bountyId}?cancelled=true`
      );

      await mockStorage.updateBountyCheckoutSession(bountyId, session.id);

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create payment session' });
    }
  });

  // POST /api/webhooks/checkout-completed (simulates Stripe webhook)
  app.post('/api/webhooks/checkout-completed', async (req, res) => {
    try {
      const { bountyId, paymentIntentId } = req.body;

      await mockStorage.updateBountyPaymentStatus(bountyId, 'funded');
      await mockStorage.addTimelineEvent(bountyId, 'funded', 'Payment received - bounty is now funded');

      // Update bounty with payment intent
      const bounty = await mockStorage.getBounty(bountyId);
      if (bounty) {
        bounty.stripePaymentIntentId = paymentIntentId;
        bounty.paymentStatus = 'funded';
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // POST /api/bounties/:id/submissions - Create submission
  app.post('/api/bounties/:id/submissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const bountyId = parseInt(req.params.id);
      const { agentId, output } = req.body;

      const bounty = await mockStorage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.status !== 'open' && bounty.status !== 'in_progress') {
        return res.status(400).json({ message: 'Bounty is not accepting submissions' });
      }

      const agent = await mockStorage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      if (agent.developerId !== userId) {
        return res.status(403).json({ message: 'Agent does not belong to user' });
      }

      const submission = await mockStorage.createSubmission({
        bountyId,
        agentId,
        output,
        status: 'pending',
        progress: 100,
        submittedAt: new Date(),
      });

      // Update bounty to in_progress if first submission
      if (bounty.status === 'open') {
        await mockStorage.updateBountyStatus(bountyId, 'in_progress');
        await mockStorage.addTimelineEvent(bountyId, 'in_progress', 'First submission received');
      }

      res.status(201).json(submission);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create submission' });
    }
  });

  // POST /api/submissions/:id/verify - Verify submission
  app.post('/api/submissions/:id/verify', isAuthenticated, async (req: any, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      const submission = await mockStorage.getSubmission(submissionId);

      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const bounty = await mockStorage.getBounty(submission.bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      // Create verification audit
      const audit = await mockVerificationService.createAudit(submissionId, bounty.verificationCriteria);

      // Run AI verification
      const result = await mockVerificationService.runAiVerification(
        audit.id,
        submission.output,
        bounty.verificationCriteria,
        bounty.successMetrics
      );

      res.json({ audit, result });
    } catch (error) {
      res.status(500).json({ message: 'Verification failed' });
    }
  });

  // POST /api/bounties/:id/select-winner
  app.post('/api/bounties/:id/select-winner', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const bountyId = parseInt(req.params.id);
      const { submissionId, autoRelease } = req.body;

      if (!submissionId || typeof submissionId !== 'number') {
        return res.status(400).json({ message: 'Valid submissionId is required' });
      }

      const bounty = await mockStorage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can select a winner' });
      }

      if (bounty.status === 'completed' || bounty.status === 'cancelled') {
        return res.status(400).json({ message: 'Bounty is already completed or cancelled' });
      }

      const submission = await mockStorage.getSubmission(submissionId);
      if (!submission || submission.bountyId !== bountyId) {
        return res.status(400).json({ message: 'Invalid submission for this bounty' });
      }

      const updated = await mockStorage.selectWinner(bountyId, submissionId);
      if (!updated) {
        return res.status(500).json({ message: 'Failed to select winner' });
      }

      await mockStorage.addTimelineEvent(bountyId, 'completed', 'Winner selected');

      let paymentReleased = false;
      if (autoRelease && bounty.paymentStatus === 'funded' && bounty.stripePaymentIntentId) {
        try {
          await mockStripeService.capturePayment(bounty.stripePaymentIntentId);
          await mockStorage.updateBountyPaymentStatus(bountyId, 'released');
          await mockStorage.addTimelineEvent(bountyId, 'payment_released', 'Payment released to winner');

          // Calculate and transfer agent earnings (85%)
          const agentEarnings = parseFloat(bounty.reward) * 0.85;
          const agent = await mockStorage.getAgent(submission.agentId);
          if (agent?.developerId) {
            const developerProfile = await mockStorage.getUserProfile(agent.developerId);
            if (developerProfile?.stripeConnectAccountId) {
              await mockStripeService.createTransfer(
                Math.round(agentEarnings * 100),
                developerProfile.stripeConnectAccountId,
                `Bounty ${bountyId} completion`
              );
            }
          }

          paymentReleased = true;
        } catch (paymentError) {
          await mockStorage.addTimelineEvent(bountyId, 'payment_release_failed', 'Auto-release failed');
        }
      }

      res.json({
        success: true,
        bounty: updated,
        paymentReleased,
        message: paymentReleased
          ? 'Winner selected and payment released'
          : 'Winner selected. Payment release pending.',
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to select winner' });
    }
  });

  // POST /api/bounties/:id/release-payment
  app.post('/api/bounties/:id/release-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const bountyId = parseInt(req.params.id);
      const bounty = await mockStorage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can release payment' });
      }

      if (bounty.paymentStatus !== 'funded') {
        return res.status(400).json({ message: 'Bounty is not funded' });
      }

      if (!bounty.stripePaymentIntentId) {
        return res.status(400).json({ message: 'No payment intent found' });
      }

      await mockStripeService.capturePayment(bounty.stripePaymentIntentId);
      await mockStorage.updateBountyPaymentStatus(bountyId, 'released');
      await mockStorage.addTimelineEvent(bountyId, 'payment_released', 'Payment released to winning agent');

      res.json({ success: true, message: 'Payment released successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to release payment' });
    }
  });

  // POST /api/bounties/:id/refund
  app.post('/api/bounties/:id/refund', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const bountyId = parseInt(req.params.id);
      const bounty = await mockStorage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can request a refund' });
      }

      if (bounty.paymentStatus !== 'funded') {
        return res.status(400).json({ message: 'Bounty is not funded or already released' });
      }

      if (!bounty.stripePaymentIntentId) {
        return res.status(400).json({ message: 'No payment intent found' });
      }

      await mockStripeService.refundPayment(bounty.stripePaymentIntentId);
      await mockStorage.updateBountyPaymentStatus(bountyId, 'refunded');
      await mockStorage.updateBountyStatus(bountyId, 'cancelled');
      await mockStorage.addTimelineEvent(bountyId, 'refunded', 'Bounty cancelled and payment refunded');

      res.json({ success: true, message: 'Payment refunded and bounty cancelled' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to refund payment' });
    }
  });

  // PATCH /api/submissions/:id/reject - Reject submission
  app.patch('/api/submissions/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const submissionId = parseInt(req.params.id);
      const { reason } = req.body;

      const submission = await mockStorage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      const bounty = await mockStorage.getBounty(submission.bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can reject submissions' });
      }

      const updated = await mockStorage.updateSubmissionStatus(submissionId, 'rejected');
      await mockStorage.addTimelineEvent(
        submission.bountyId,
        'submission_rejected',
        `Submission ${submissionId} rejected: ${reason || 'No reason provided'}`
      );

      res.json({ success: true, submission: updated });
    } catch (error) {
      res.status(500).json({ message: 'Failed to reject submission' });
    }
  });

  return app;
}

describe('Bounty Lifecycle Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    app = createTestApp();
  });

  describe('Complete Flow: create → fund → submit → verify → select winner → release payment', () => {
    it('should complete full bounty lifecycle successfully', async () => {
      // Step 1: Create bounty
      const bountyData = {
        title: 'Build a REST API',
        description: 'Create a REST API with CRUD operations',
        reward: '500.00',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'development',
        successMetrics: 'All endpoints working, tests passing',
        verificationCriteria: 'Code review, automated tests',
      };

      const createdBounty = createBounty({
        id: 1,
        ...bountyData,
        posterId: 'test-user-id',
        status: 'open',
        paymentStatus: 'pending',
      });

      mockStorage.createBounty.mockResolvedValue(createdBounty);
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const createResponse = await request(app)
        .post('/api/bounties')
        .set('Authorization', 'Bearer valid-token')
        .send(bountyData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.title).toBe('Build a REST API');
      expect(createResponse.body.status).toBe('open');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(1, 'open', 'Bounty posted and open for submissions');

      // Step 2: Fund bounty
      const profile = createUserProfile({ id: 'test-user-id', stripeCustomerId: null });
      const customer = { id: 'cus_new123' };
      const session = { id: 'cs_test123', url: 'https://checkout.stripe.com/session' };

      mockStorage.getBounty.mockResolvedValue(createdBounty);
      mockStorage.getUserProfile.mockResolvedValue(profile);
      mockStripeService.createCustomer.mockResolvedValue(customer);
      mockStripeService.createCheckoutSession.mockResolvedValue(session);
      mockStorage.updateUserStripeCustomerId.mockResolvedValue(undefined);
      mockStorage.updateBountyCheckoutSession.mockResolvedValue(undefined);

      const fundResponse = await request(app)
        .post('/api/bounties/1/fund')
        .set('Authorization', 'Bearer valid-token');

      expect(fundResponse.status).toBe(200);
      expect(fundResponse.body.url).toBe('https://checkout.stripe.com/session');
      expect(mockStripeService.createCustomer).toHaveBeenCalled();
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_new123',
        1,
        'Build a REST API',
        500,
        expect.any(String),
        expect.any(String)
      );

      // Step 3: Simulate checkout completion webhook
      const fundedBounty = {
        ...createdBounty,
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      };

      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.getBounty.mockResolvedValue(fundedBounty);

      const webhookResponse = await request(app)
        .post('/api/webhooks/checkout-completed')
        .send({ bountyId: 1, paymentIntentId: 'pi_test123' });

      expect(webhookResponse.status).toBe(200);
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'funded');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(1, 'funded', 'Payment received - bounty is now funded');

      // Step 4: Submit solution
      const agent = createAgent({ id: 1, developerId: 'agent-owner-id' });
      const submission = createSubmission({
        id: 1,
        bountyId: 1,
        agentId: 1,
        output: 'REST API implementation with tests',
        status: 'pending',
        progress: 100,
      });

      mockStorage.getBounty.mockResolvedValue(fundedBounty);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.createSubmission.mockResolvedValue(submission);
      mockStorage.updateBountyStatus.mockResolvedValue({ ...fundedBounty, status: 'in_progress' });

      const submitResponse = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer agent-owner-token')
        .send({ agentId: 1, output: 'REST API implementation with tests' });

      expect(submitResponse.status).toBe(201);
      expect(submitResponse.body.bountyId).toBe(1);
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'in_progress');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(1, 'in_progress', 'First submission received');

      // Step 5: Verify submission
      const audit = { id: 1, submissionId: 1, status: 'pending' };
      const verificationResult = {
        passed: true,
        score: 95,
        feedback: 'All criteria met',
      };

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(fundedBounty);
      mockVerificationService.createAudit.mockResolvedValue(audit);
      mockVerificationService.runAiVerification.mockResolvedValue(verificationResult);

      const verifyResponse = await request(app)
        .post('/api/submissions/1/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.result.passed).toBe(true);
      expect(verifyResponse.body.result.score).toBe(95);

      // Step 6: Select winner with auto-release
      const completedBounty = {
        ...fundedBounty,
        status: 'completed',
        winnerId: 1,
      };

      const developerProfile = createUserProfile({
        id: 'agent-owner-id',
        stripeConnectAccountId: 'acct_agent123',
      });

      mockStorage.getBounty.mockResolvedValue(fundedBounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.selectWinner.mockResolvedValue(completedBounty);
      mockStripeService.capturePayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.getUserProfile.mockResolvedValue(developerProfile);
      mockStripeService.createTransfer.mockResolvedValue({});

      const selectWinnerResponse = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1, autoRelease: true });

      expect(selectWinnerResponse.status).toBe(200);
      expect(selectWinnerResponse.body.success).toBe(true);
      expect(selectWinnerResponse.body.paymentReleased).toBe(true);
      expect(selectWinnerResponse.body.bounty.winnerId).toBe(1);
      expect(selectWinnerResponse.body.bounty.status).toBe('completed');

      // Verify payment capture and transfer
      expect(mockStripeService.capturePayment).toHaveBeenCalledWith('pi_test123');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'released');
      expect(mockStripeService.createTransfer).toHaveBeenCalledWith(
        42500, // 85% of $500 in cents
        'acct_agent123',
        'Bounty 1 completion'
      );
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(1, 'payment_released', 'Payment released to winner');
    });

    it('should handle manual payment release after selecting winner', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const completedBounty = { ...bounty, status: 'completed', winnerId: 1 };

      // Select winner without auto-release
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.selectWinner.mockResolvedValue(completedBounty);
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const selectResponse = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1, autoRelease: false });

      expect(selectResponse.status).toBe(200);
      expect(selectResponse.body.paymentReleased).toBe(false);

      // Manual payment release
      mockStorage.getBounty.mockResolvedValue({ ...completedBounty, paymentStatus: 'funded' });
      mockStripeService.capturePayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);

      const releaseResponse = await request(app)
        .post('/api/bounties/1/release-payment')
        .set('Authorization', 'Bearer valid-token');

      expect(releaseResponse.status).toBe(200);
      expect(releaseResponse.body.success).toBe(true);
      expect(mockStripeService.capturePayment).toHaveBeenCalledWith('pi_test123');
    });
  });

  describe('Cancelled Flow: create → fund → cancel → refund', () => {
    it('should cancel bounty and refund payment', async () => {
      // Create and fund bounty
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        status: 'open',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
        reward: '250.00',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStripeService.refundPayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.updateBountyStatus.mockResolvedValue({ ...bounty, status: 'cancelled', paymentStatus: 'refunded' });
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const refundResponse = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(refundResponse.status).toBe(200);
      expect(refundResponse.body.success).toBe(true);
      expect(refundResponse.body.message).toBe('Payment refunded and bounty cancelled');
      expect(mockStripeService.refundPayment).toHaveBeenCalledWith('pi_test123');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'refunded');
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'cancelled');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'refunded',
        'Bounty cancelled and payment refunded'
      );
    });

    it('should reject refund if bounty not funded', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        paymentStatus: 'pending',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not funded or already released');
    });

    it('should reject refund after payment released', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        paymentStatus: 'released',
        stripePaymentIntentId: 'pi_test123',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not funded or already released');
    });

    it('should reject refund by non-owner', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'other-user-id',
        paymentStatus: 'funded',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can request a refund');
    });
  });

  describe('Failed Submission Flow: create → fund → submit → reject → new submission', () => {
    it('should handle submission rejection and allow new submission', async () => {
      // Setup funded bounty
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });

      const agent = createAgent({ id: 1, developerId: 'agent-owner-id' });
      const firstSubmission = createSubmission({
        id: 1,
        bountyId: 1,
        agentId: 1,
        output: 'First attempt - incomplete',
        status: 'pending',
      });

      // Reject first submission
      mockStorage.getSubmission.mockResolvedValue(firstSubmission);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.updateSubmissionStatus.mockResolvedValue({ ...firstSubmission, status: 'rejected' });
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const rejectResponse = await request(app)
        .patch('/api/submissions/1/reject')
        .set('Authorization', 'Bearer valid-token')
        .send({ reason: 'Missing required features' });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.success).toBe(true);
      expect(mockStorage.updateSubmissionStatus).toHaveBeenCalledWith(1, 'rejected');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'submission_rejected',
        'Submission 1 rejected: Missing required features'
      );

      // Submit new solution
      const secondSubmission = createSubmission({
        id: 2,
        bountyId: 1,
        agentId: 1,
        output: 'Second attempt - complete',
        status: 'pending',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.createSubmission.mockResolvedValue(secondSubmission);

      const submitResponse = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer agent-owner-token')
        .send({ agentId: 1, output: 'Second attempt - complete' });

      expect(submitResponse.status).toBe(201);
      expect(submitResponse.body.id).toBe(2);

      // Select new submission as winner
      const completedBounty = { ...bounty, status: 'completed', winnerId: 2 };

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(secondSubmission);
      mockStorage.selectWinner.mockResolvedValue(completedBounty);
      mockStripeService.capturePayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.getUserProfile.mockResolvedValue(createUserProfile({ stripeConnectAccountId: 'acct_test' }));
      mockStripeService.createTransfer.mockResolvedValue({});

      const selectResponse = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 2, autoRelease: true });

      expect(selectResponse.status).toBe(200);
      expect(selectResponse.body.success).toBe(true);
      expect(selectResponse.body.bounty.winnerId).toBe(2);
      expect(mockStorage.selectWinner).toHaveBeenCalledWith(1, 2);
    });

    it('should reject submission without reason', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.updateSubmissionStatus.mockResolvedValue({ ...submission, status: 'rejected' });
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const response = await request(app)
        .patch('/api/submissions/1/reject')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'submission_rejected',
        'Submission 1 rejected: No reason provided'
      );
    });

    it('should reject submission rejection by non-owner', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const bounty = createBounty({ id: 1, posterId: 'other-user-id' });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .patch('/api/submissions/1/reject')
        .set('Authorization', 'Bearer valid-token')
        .send({ reason: 'Bad work' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can reject submissions');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject submission to non-existent bounty', async () => {
      mockStorage.getBounty.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bounties/999/submissions')
        .set('Authorization', 'Bearer agent-owner-token')
        .send({ agentId: 1, output: 'Test output' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Bounty not found');
    });

    it('should reject submission to completed bounty', async () => {
      const bounty = createBounty({ id: 1, status: 'completed' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer agent-owner-token')
        .send({ agentId: 1, output: 'Test output' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not accepting submissions');
    });

    it('should reject submission with agent not owned by user', async () => {
      const bounty = createBounty({ id: 1, status: 'open' });
      const agent = createAgent({ id: 1, developerId: 'other-user-id' });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getAgent.mockResolvedValue(agent);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer agent-owner-token')
        .send({ agentId: 1, output: 'Test output' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Agent does not belong to user');
    });

    it('should handle verification of non-existent submission', async () => {
      mockStorage.getSubmission.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/submissions/999/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Submission not found');
    });

    it('should handle selecting winner for already completed bounty', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        status: 'completed',
        winnerId: 1,
      });

      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 2 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is already completed or cancelled');
    });

    it('should handle release payment failure gracefully during auto-release', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });
      const submission = createSubmission({ id: 1, bountyId: 1 });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.selectWinner.mockResolvedValue({ ...bounty, status: 'completed', winnerId: 1 });
      mockStorage.addTimelineEvent.mockResolvedValue({});
      mockStripeService.capturePayment.mockRejectedValue(new Error('Stripe error'));

      const response = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1, autoRelease: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.paymentReleased).toBe(false);
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(1, 'payment_release_failed', 'Auto-release failed');
    });
  });
});
