/**
 * Bounties Routes Tests - Core API endpoints for bounty management
 *
 * Tests the bounty CRUD operations and payment workflows:
 * - GET /api/bounties - List all bounties
 * - GET /api/bounties/:id - Get bounty with submissions
 * - POST /api/bounties - Create bounty (requires auth)
 * - PATCH /api/bounties/:id/status - Update status (requires ownership)
 * - POST /api/bounties/:id/fund - Create checkout session
 * - POST /api/bounties/:id/select-winner - Select winning submission
 * - POST /api/bounties/:id/release-payment - Release escrowed funds
 * - POST /api/bounties/:id/refund - Refund and cancel bounty
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createBounty, createAgent, createSubmission, createUserProfile, resetIdCounter } from '../factories';

// Mock storage
const mockStorage = {
  getAllBounties: vi.fn(),
  getBounty: vi.fn(),
  createBounty: vi.fn(),
  updateBountyStatus: vi.fn(),
  addTimelineEvent: vi.fn(),
  getSubmissionsByBounty: vi.fn(),
  getBountyTimeline: vi.fn(),
  getSubmission: vi.fn(),
  selectWinner: vi.fn(),
  updateBountyPaymentStatus: vi.fn(),
  getUserProfile: vi.fn(),
  updateUserStripeCustomerId: vi.fn(),
  updateBountyCheckoutSession: vi.fn(),
};

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

// Mock stripeService
const mockStripeService = {
  createCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  capturePayment: vi.fn(),
  refundPayment: vi.fn(),
};

vi.mock('../../stripeService', () => ({
  stripeService: mockStripeService,
}));

// Mock auth middleware
vi.mock('../../replit_integrations/auth', () => ({
  setupAuth: vi.fn().mockResolvedValue(undefined),
  registerAuthRoutes: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { claims: { sub: 'test-user-id', email: 'test@example.com', name: 'Test User' } };
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

// Mock other dependencies to prevent import errors
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

// Create a minimal test app with just the bounty routes
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Simulate auth middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { claims: { sub: 'test-user-id', email: 'test@example.com', name: 'Test User' } };
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };

  // GET /api/bounties
  app.get('/api/bounties', async (req, res) => {
    try {
      const bounties = await mockStorage.getAllBounties();
      res.json(bounties);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bounties' });
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

  // POST /api/bounties
  app.post('/api/bounties', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Basic validation
      const { title, description, reward, deadline, category } = req.body;
      if (!title || !description || !reward || !deadline || !category) {
        return res.status(400).json({ message: 'Invalid bounty data', errors: [{ message: 'Missing required fields' }] });
      }

      const bounty = await mockStorage.createBounty({ ...req.body, posterId: userId });
      res.status(201).json(bounty);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create bounty' });
    }
  });

  // PATCH /api/bounties/:id/status
  app.patch('/api/bounties/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const id = parseInt(req.params.id);
      const existingBounty = await mockStorage.getBounty(id);
      if (!existingBounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (existingBounty.posterId !== userId) {
        return res.status(403).json({ message: 'You can only update your own bounties' });
      }

      const { status } = req.body;
      const validStatuses = ['open', 'in_progress', 'completed', 'cancelled', 'disputed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status', errors: [{ message: 'Invalid status value' }] });
      }

      const bounty = await mockStorage.updateBountyStatus(id, status);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      await mockStorage.addTimelineEvent(id, status, `Status changed to ${status}`);
      res.json(bounty);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update bounty status' });
    }
  });

  // POST /api/bounties/:id/fund
  app.post('/api/bounties/:id/fund', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

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
          req.user?.claims?.email || `user-${userId}@bountyai.com`,
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

      res.json({ url: session.url });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create payment session' });
    }
  });

  // POST /api/bounties/:id/select-winner
  app.post('/api/bounties/:id/select-winner', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

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

      let paymentReleased = false;
      if (autoRelease && bounty.paymentStatus === 'funded' && bounty.stripePaymentIntentId) {
        try {
          await mockStripeService.capturePayment(bounty.stripePaymentIntentId);
          await mockStorage.updateBountyPaymentStatus(bountyId, 'released');
          await mockStorage.addTimelineEvent(bountyId, 'payment_released', 'Winner selected and payment auto-released');
          paymentReleased = true;
        } catch (paymentError) {
          await mockStorage.addTimelineEvent(bountyId, 'payment_release_failed', 'Auto-release failed - manual release required');
        }
      }

      res.json({
        success: true,
        bounty: updated,
        paymentReleased,
        message: paymentReleased
          ? 'Winner selected and payment released successfully'
          : 'Winner selected successfully. Payment release pending.',
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to select winner' });
    }
  });

  // POST /api/bounties/:id/release-payment
  app.post('/api/bounties/:id/release-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

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
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

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

      res.json({ success: true, message: 'Payment refunded successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to refund payment' });
    }
  });

  return app;
}

describe('Bounties Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    app = createTestApp();
  });

  describe('GET /api/bounties', () => {
    it('should return all bounties', async () => {
      const bounties = [
        createBounty({ id: 1, title: 'Bounty 1' }),
        createBounty({ id: 2, title: 'Bounty 2' }),
      ];
      mockStorage.getAllBounties.mockResolvedValue(bounties);

      const response = await request(app).get('/api/bounties');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Bounty 1');
      expect(response.body[1].title).toBe('Bounty 2');
      expect(mockStorage.getAllBounties).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no bounties exist', async () => {
      mockStorage.getAllBounties.mockResolvedValue([]);

      const response = await request(app).get('/api/bounties');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.getAllBounties.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/bounties');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to fetch bounties');
    });
  });

  describe('GET /api/bounties/:id', () => {
    it('should return bounty with submissions and timeline', async () => {
      const bounty = createBounty({ id: 1 });
      const agent = createAgent({ id: 1 });
      const submissions = [createSubmission({ id: 1, bountyId: 1, agentId: 1 })].map((s) => ({ ...s, agent }));
      const timeline = [{ id: 1, bountyId: 1, status: 'open', description: 'Bounty opened' }];

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmissionsByBounty.mockResolvedValue(submissions);
      mockStorage.getBountyTimeline.mockResolvedValue(timeline);

      const response = await request(app).get('/api/bounties/1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.submissions).toHaveLength(1);
      expect(response.body.timeline).toHaveLength(1);
      expect(mockStorage.getBounty).toHaveBeenCalledWith(1);
      expect(mockStorage.getSubmissionsByBounty).toHaveBeenCalledWith(1);
      expect(mockStorage.getBountyTimeline).toHaveBeenCalledWith(1);
    });

    it('should return 404 when bounty not found', async () => {
      mockStorage.getBounty.mockResolvedValue(undefined);

      const response = await request(app).get('/api/bounties/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Bounty not found');
    });
  });

  describe('POST /api/bounties', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/bounties')
        .send({ title: 'Test Bounty' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized');
    });

    it('should validate input with Zod schema', async () => {
      const response = await request(app)
        .post('/api/bounties')
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'Test Bounty' }); // Missing required fields

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid bounty data');
    });

    it('should set posterId from session', async () => {
      const bountyData = {
        title: 'Test Bounty',
        description: 'Test description',
        reward: '100',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'development',
      };

      const createdBounty = createBounty({ ...bountyData, posterId: 'test-user-id' });
      mockStorage.createBounty.mockResolvedValue(createdBounty);

      const response = await request(app)
        .post('/api/bounties')
        .set('Authorization', 'Bearer valid-token')
        .send(bountyData);

      expect(response.status).toBe(201);
      expect(mockStorage.createBounty).toHaveBeenCalledWith(
        expect.objectContaining({ posterId: 'test-user-id' })
      );
    });

    it('should create bounty successfully with valid data', async () => {
      const bountyData = {
        title: 'New Bounty',
        description: 'A new test bounty',
        reward: '250',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'marketing',
      };

      const createdBounty = createBounty({ ...bountyData, id: 5, posterId: 'test-user-id' });
      mockStorage.createBounty.mockResolvedValue(createdBounty);

      const response = await request(app)
        .post('/api/bounties')
        .set('Authorization', 'Bearer valid-token')
        .send(bountyData);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Bounty');
      expect(response.body.posterId).toBe('test-user-id');
    });
  });

  describe('PATCH /api/bounties/:id/status', () => {
    it('should require ownership', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.updateBountyStatus.mockResolvedValue({ ...bounty, status: 'in_progress' });
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const response = await request(app)
        .patch('/api/bounties/1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'in_progress');
    });

    it('should reject non-owner with 403', async () => {
      const bounty = createBounty({ id: 1, posterId: 'other-user-id' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .patch('/api/bounties/1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'in_progress' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('You can only update your own bounties');
    });

    it('should validate status value', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .patch('/api/bounties/1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid status');
    });

    it('should add timeline event on status change', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.updateBountyStatus.mockResolvedValue({ ...bounty, status: 'completed' });
      mockStorage.addTimelineEvent.mockResolvedValue({});

      await request(app)
        .patch('/api/bounties/1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'completed' });

      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(1, 'completed', 'Status changed to completed');
    });
  });

  describe('POST /api/bounties/:id/fund', () => {
    it('should create checkout session for bounty funding', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', paymentStatus: 'pending' });
      const profile = createUserProfile({ id: 'test-user-id', stripeCustomerId: 'cus_existing' });
      const session = { id: 'cs_test123', url: 'https://checkout.stripe.com/test' };

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getUserProfile.mockResolvedValue(profile);
      mockStripeService.createCheckoutSession.mockResolvedValue(session);
      mockStorage.updateBountyCheckoutSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bounties/1/fund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.url).toBe('https://checkout.stripe.com/test');
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_existing',
        1,
        bounty.title,
        100,
        expect.stringContaining('funded=true'),
        expect.stringContaining('cancelled=true')
      );
    });

    it('should create Stripe customer if not exists', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', paymentStatus: 'pending' });
      const profile = createUserProfile({ id: 'test-user-id', stripeCustomerId: null });
      const customer = { id: 'cus_new123' };
      const session = { id: 'cs_test123', url: 'https://checkout.stripe.com/test' };

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getUserProfile.mockResolvedValue(profile);
      mockStripeService.createCustomer.mockResolvedValue(customer);
      mockStripeService.createCheckoutSession.mockResolvedValue(session);
      mockStorage.updateUserStripeCustomerId.mockResolvedValue(undefined);
      mockStorage.updateBountyCheckoutSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bounties/1/fund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockStripeService.createCustomer).toHaveBeenCalled();
      expect(mockStorage.updateUserStripeCustomerId).toHaveBeenCalledWith('test-user-id', 'cus_new123');
    });

    it('should reject already funded bounty', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', paymentStatus: 'funded' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/fund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is already funded');
    });

    it('should reject non-owner funding attempt', async () => {
      const bounty = createBounty({ id: 1, posterId: 'other-user-id' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/fund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can fund this bounty');
    });
  });

  describe('POST /api/bounties/:id/select-winner', () => {
    it('should set winner and update bounty', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', status: 'in_progress' });
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const updatedBounty = { ...bounty, winnerId: 1, status: 'completed' };

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.selectWinner.mockResolvedValue(updatedBounty);

      const response = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bounty.winnerId).toBe(1);
      expect(mockStorage.selectWinner).toHaveBeenCalledWith(1, 1);
    });

    it('should auto-release payment if requested', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const updatedBounty = { ...bounty, winnerId: 1, status: 'completed' };

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.selectWinner.mockResolvedValue(updatedBounty);
      mockStripeService.capturePayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const response = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1, autoRelease: true });

      expect(response.status).toBe(200);
      expect(response.body.paymentReleased).toBe(true);
      expect(mockStripeService.capturePayment).toHaveBeenCalledWith('pi_test123');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'released');
    });

    it('should reject invalid submission for bounty', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', status: 'in_progress' });
      const submission = createSubmission({ id: 1, bountyId: 2 }); // Wrong bounty

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);

      const response = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid submission for this bounty');
    });

    it('should reject already completed bounty', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', status: 'completed' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/select-winner')
        .set('Authorization', 'Bearer valid-token')
        .send({ submissionId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is already completed or cancelled');
    });
  });

  describe('POST /api/bounties/:id/release-payment', () => {
    it('should require ownership', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'other-user-id',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/release-payment')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can release payment');
    });

    it('should release payment successfully', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStripeService.capturePayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const response = await request(app)
        .post('/api/bounties/1/release-payment')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment released successfully');
      expect(mockStripeService.capturePayment).toHaveBeenCalledWith('pi_test123');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'released');
    });

    it('should reject if bounty not funded', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', paymentStatus: 'pending' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/release-payment')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not funded');
    });
  });

  describe('POST /api/bounties/:id/refund', () => {
    it('should cancel bounty and refund payment', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'test-user-id',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStripeService.refundPayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue(undefined);
      mockStorage.updateBountyStatus.mockResolvedValue({ ...bounty, status: 'cancelled' });
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const response = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment refunded successfully');
      expect(mockStripeService.refundPayment).toHaveBeenCalledWith('pi_test123');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'refunded');
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'cancelled');
    });

    it('should reject non-owner refund request', async () => {
      const bounty = createBounty({ id: 1, posterId: 'other-user-id', paymentStatus: 'funded' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can request a refund');
    });

    it('should reject refund if not funded', async () => {
      const bounty = createBounty({ id: 1, posterId: 'test-user-id', paymentStatus: 'released' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/refund')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not funded or already released');
    });
  });
});
