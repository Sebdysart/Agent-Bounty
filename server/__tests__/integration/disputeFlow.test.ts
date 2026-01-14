/**
 * Dispute Flow Integration Tests
 *
 * Tests complete end-to-end flows for dispute operations:
 * - Dispute flow: submission → dispute → messages → resolution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createBounty, createAgent, createSubmission, createDispute, createUserProfile, resetIdCounter } from '../factories';

// Mock storage with dispute lifecycle support
const mockStorage = {
  // Bounty operations
  getBounty: vi.fn(),
  updateBountyStatus: vi.fn(),
  addTimelineEvent: vi.fn(),
  updateBountyPaymentStatus: vi.fn(),
  // Submission operations
  getSubmission: vi.fn(),
  updateSubmissionStatus: vi.fn(),
  // Agent operations
  getAgent: vi.fn(),
  // User operations
  getUserProfile: vi.fn(),
  // Dispute operations
  createDispute: vi.fn(),
  getDispute: vi.fn(),
  updateDispute: vi.fn(),
  getDisputesByBounty: vi.fn(),
  getDisputesByUser: vi.fn(),
  // Dispute messages
  createDisputeMessage: vi.fn(),
  getDisputeMessages: vi.fn(),
};

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

// Mock Stripe service
const mockStripeService = {
  capturePayment: vi.fn(),
  refundPayment: vi.fn(),
  createTransfer: vi.fn(),
};

vi.mock('../../stripeService', () => ({
  stripeService: mockStripeService,
}));

// Mock auth
vi.mock('../../replit_integrations/auth', () => ({
  setupAuth: vi.fn().mockResolvedValue(undefined),
  registerAuthRoutes: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer poster-token') {
      req.user = { claims: { sub: 'poster-id', email: 'poster@example.com', name: 'Bounty Poster' } };
      next();
    } else if (req.headers.authorization === 'Bearer agent-owner-token') {
      req.user = { claims: { sub: 'agent-owner-id', email: 'agent@example.com', name: 'Agent Owner' } };
      next();
    } else if (req.headers.authorization === 'Bearer admin-token') {
      req.user = { claims: { sub: 'admin-id', email: 'admin@example.com', name: 'Admin User' } };
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
  requireAdmin: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer admin-token') {
      next();
    } else {
      res.status(403).json({ message: 'Admin access required' });
    }
  }),
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
 * Create test app with dispute routes
 */
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Auth middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer poster-token') {
      req.user = { claims: { sub: 'poster-id', email: 'poster@example.com', name: 'Bounty Poster' } };
      next();
    } else if (req.headers.authorization === 'Bearer agent-owner-token') {
      req.user = { claims: { sub: 'agent-owner-id', email: 'agent@example.com', name: 'Agent Owner' } };
      next();
    } else if (req.headers.authorization === 'Bearer admin-token') {
      req.user = { claims: { sub: 'admin-id', email: 'admin@example.com', name: 'Admin User' } };
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer admin-token') {
      next();
    } else {
      res.status(403).json({ message: 'Admin access required' });
    }
  };

  // POST /api/disputes - Create a dispute
  app.post('/api/disputes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { bountyId, submissionId, category, title, description } = req.body;

      if (!bountyId || !submissionId || !category || !title || !description) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Validate category
      const validCategories = ['quality', 'deadline', 'scope', 'payment', 'other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: 'Invalid dispute category' });
      }

      const bounty = await mockStorage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      const submission = await mockStorage.getSubmission(submissionId);
      if (!submission || submission.bountyId !== bountyId) {
        return res.status(404).json({ message: 'Submission not found for this bounty' });
      }

      const agent = await mockStorage.getAgent(submission.agentId);
      if (!agent) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      // Verify user is either bounty poster or agent owner
      const isPoster = bounty.posterId === userId;
      const isAgentOwner = agent.developerId === userId;

      if (!isPoster && !isAgentOwner) {
        return res.status(403).json({ message: 'Only bounty poster or agent owner can create disputes' });
      }

      // Determine respondent
      const respondentId = isPoster ? agent.developerId : bounty.posterId;

      const dispute = await mockStorage.createDispute({
        bountyId,
        submissionId,
        initiatorId: userId,
        respondentId,
        category,
        title,
        description,
        status: 'open',
        priority: 'medium',
      });

      // Add timeline event
      await mockStorage.addTimelineEvent(bountyId, 'dispute_opened', `Dispute opened: ${title}`);

      res.status(201).json(dispute);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create dispute' });
    }
  });

  // GET /api/disputes/:id - Get dispute details
  app.get('/api/disputes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const disputeId = parseInt(req.params.id);

      const dispute = await mockStorage.getDispute(disputeId);
      if (!dispute) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      // Only involved parties and admins can view
      const isInvolved = dispute.initiatorId === userId || dispute.respondentId === userId;
      const isAdmin = req.headers.authorization === 'Bearer admin-token';

      if (!isInvolved && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to view this dispute' });
      }

      const messages = await mockStorage.getDisputeMessages(disputeId);
      res.json({ ...dispute, messages });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dispute' });
    }
  });

  // GET /api/disputes - Get user's disputes
  app.get('/api/disputes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const disputes = await mockStorage.getDisputesByUser(userId);
      res.json(disputes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch disputes' });
    }
  });

  // POST /api/disputes/:id/messages - Add message to dispute
  app.post('/api/disputes/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const disputeId = parseInt(req.params.id);
      const { content, attachments } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: 'Message content is required' });
      }

      const dispute = await mockStorage.getDispute(disputeId);
      if (!dispute) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      if (dispute.status === 'resolved' || dispute.status === 'closed') {
        return res.status(400).json({ message: 'Cannot add messages to resolved or closed disputes' });
      }

      // Only involved parties and admins can message
      const isInvolved = dispute.initiatorId === userId || dispute.respondentId === userId;
      const isAdmin = req.headers.authorization === 'Bearer admin-token';

      if (!isInvolved && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to message in this dispute' });
      }

      const message = await mockStorage.createDisputeMessage({
        disputeId,
        senderId: userId,
        content: content.trim(),
        attachments: attachments || [],
        isInternal: false,
      });

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create message' });
    }
  });

  // PATCH /api/disputes/:id/status - Update dispute status (admin only)
  app.patch('/api/disputes/:id/status', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const disputeId = parseInt(req.params.id);
      const { status, priority, assignedTo } = req.body;

      const dispute = await mockStorage.getDispute(disputeId);
      if (!dispute) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      const validStatuses = ['open', 'under_review', 'pending_response', 'resolved', 'closed'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid dispute status' });
      }

      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ message: 'Invalid priority level' });
      }

      const updatedDispute = await mockStorage.updateDispute(disputeId, {
        status: status || dispute.status,
        priority: priority || dispute.priority,
        assignedTo: assignedTo !== undefined ? assignedTo : dispute.assignedTo,
      });

      if (status) {
        await mockStorage.addTimelineEvent(
          dispute.bountyId,
          `dispute_${status}`,
          `Dispute status changed to ${status}`
        );
      }

      res.json(updatedDispute);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update dispute' });
    }
  });

  // POST /api/disputes/:id/resolve - Resolve dispute (admin only)
  app.post('/api/disputes/:id/resolve', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const disputeId = parseInt(req.params.id);
      const { resolution, resolutionNotes, action } = req.body;

      if (!resolution) {
        return res.status(400).json({ message: 'Resolution decision is required' });
      }

      const validResolutions = ['favor_poster', 'favor_agent', 'partial_refund', 'no_action', 'mutual_agreement'];
      if (!validResolutions.includes(resolution)) {
        return res.status(400).json({ message: 'Invalid resolution type' });
      }

      const dispute = await mockStorage.getDispute(disputeId);
      if (!dispute) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      if (dispute.status === 'resolved' || dispute.status === 'closed') {
        return res.status(400).json({ message: 'Dispute is already resolved or closed' });
      }

      const bounty = await mockStorage.getBounty(dispute.bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      // Handle resolution actions
      let paymentAction = null;
      if (action === 'refund' && bounty.paymentStatus === 'funded' && bounty.stripePaymentIntentId) {
        await mockStripeService.refundPayment(bounty.stripePaymentIntentId);
        await mockStorage.updateBountyPaymentStatus(dispute.bountyId, 'refunded');
        await mockStorage.updateBountyStatus(dispute.bountyId, 'cancelled');
        paymentAction = 'refunded';
      } else if (action === 'release' && bounty.paymentStatus === 'funded' && bounty.stripePaymentIntentId) {
        await mockStripeService.capturePayment(bounty.stripePaymentIntentId);
        await mockStorage.updateBountyPaymentStatus(dispute.bountyId, 'released');
        paymentAction = 'released';
      } else if (action === 'partial_refund' && bounty.stripePaymentIntentId) {
        const refundAmount = req.body.refundAmount || Math.floor(parseFloat(bounty.reward) * 50); // 50% default
        await mockStripeService.refundPayment(bounty.stripePaymentIntentId, refundAmount);
        paymentAction = 'partial_refund';
      }

      const updatedDispute = await mockStorage.updateDispute(disputeId, {
        status: 'resolved',
        resolution,
        resolutionNotes: resolutionNotes || null,
      });

      await mockStorage.addTimelineEvent(
        dispute.bountyId,
        'dispute_resolved',
        `Dispute resolved: ${resolution}${paymentAction ? ` (payment ${paymentAction})` : ''}`
      );

      res.json({
        dispute: updatedDispute,
        paymentAction,
        message: 'Dispute resolved successfully',
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to resolve dispute' });
    }
  });

  // POST /api/disputes/:id/escalate - Escalate dispute priority
  app.post('/api/disputes/:id/escalate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const disputeId = parseInt(req.params.id);
      const { reason } = req.body;

      const dispute = await mockStorage.getDispute(disputeId);
      if (!dispute) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      // Only involved parties can escalate
      const isInvolved = dispute.initiatorId === userId || dispute.respondentId === userId;
      if (!isInvolved) {
        return res.status(403).json({ message: 'Not authorized to escalate this dispute' });
      }

      if (dispute.status === 'resolved' || dispute.status === 'closed') {
        return res.status(400).json({ message: 'Cannot escalate resolved or closed disputes' });
      }

      if (dispute.priority === 'urgent') {
        return res.status(400).json({ message: 'Dispute is already at highest priority' });
      }

      const priorityLevels = ['low', 'medium', 'high', 'urgent'];
      const currentIndex = priorityLevels.indexOf(dispute.priority);
      const newPriority = priorityLevels[Math.min(currentIndex + 1, priorityLevels.length - 1)];

      const updatedDispute = await mockStorage.updateDispute(disputeId, {
        priority: newPriority,
      });

      // Add escalation message
      await mockStorage.createDisputeMessage({
        disputeId,
        senderId: userId,
        content: `Dispute escalated to ${newPriority} priority. Reason: ${reason || 'Not specified'}`,
        attachments: [],
        isInternal: false,
      });

      await mockStorage.addTimelineEvent(
        dispute.bountyId,
        'dispute_escalated',
        `Dispute escalated to ${newPriority} priority`
      );

      res.json(updatedDispute);
    } catch (error) {
      res.status(500).json({ message: 'Failed to escalate dispute' });
    }
  });

  // GET /api/bounties/:id/disputes - Get disputes for a bounty
  app.get('/api/bounties/:id/disputes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const bountyId = parseInt(req.params.id);

      const bounty = await mockStorage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      // Only bounty poster, involved agents, and admins can view
      const isAdmin = req.headers.authorization === 'Bearer admin-token';
      const isPoster = bounty.posterId === userId;

      if (!isPoster && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to view disputes for this bounty' });
      }

      const disputes = await mockStorage.getDisputesByBounty(bountyId);
      res.json(disputes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch disputes' });
    }
  });

  return app;
}

describe('Dispute Flow Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    app = createTestApp();
  });

  describe('Dispute Flow: submission → dispute → messages → resolution', () => {
    it('should complete full dispute lifecycle - poster initiates, admin resolves', async () => {
      // Setup: Bounty with submission
      const bounty = createBounty({
        id: 1,
        posterId: 'poster-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test123',
        reward: '500.00',
      });
      const agent = createAgent({ id: 1, developerId: 'agent-owner-id' });
      const submission = createSubmission({
        id: 1,
        bountyId: 1,
        agentId: 1,
        status: 'pending',
        output: 'Submitted work',
      });

      // Step 1: Poster creates dispute
      const disputeData = {
        bountyId: 1,
        submissionId: 1,
        category: 'quality',
        title: 'Work does not meet requirements',
        description: 'The submitted code has bugs and missing features',
      };

      const createdDispute = createDispute({
        id: 1,
        ...disputeData,
        initiatorId: 'poster-id',
        respondentId: 'agent-owner-id',
        status: 'open',
        priority: 'medium',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.createDispute.mockResolvedValue(createdDispute);
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const createResponse = await request(app)
        .post('/api/disputes')
        .set('Authorization', 'Bearer poster-token')
        .send(disputeData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.title).toBe('Work does not meet requirements');
      expect(createResponse.body.initiatorId).toBe('poster-id');
      expect(createResponse.body.respondentId).toBe('agent-owner-id');
      expect(createResponse.body.status).toBe('open');
      expect(mockStorage.addTimelineEvent).toHaveBeenCalledWith(
        1,
        'dispute_opened',
        'Dispute opened: Work does not meet requirements'
      );

      // Step 2: Agent owner views dispute and adds response message
      mockStorage.getDispute.mockResolvedValue(createdDispute);
      mockStorage.getDisputeMessages.mockResolvedValue([]);

      const getResponse = await request(app)
        .get('/api/disputes/1')
        .set('Authorization', 'Bearer agent-owner-token');

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(1);
      expect(getResponse.body.messages).toEqual([]);

      // Step 3: Agent owner adds response message
      const message1 = {
        id: 1,
        disputeId: 1,
        senderId: 'agent-owner-id',
        content: 'I believe my work meets all requirements. Please review the test results.',
        attachments: [],
        isInternal: false,
        createdAt: new Date(),
      };

      mockStorage.createDisputeMessage.mockResolvedValue(message1);

      const messageResponse1 = await request(app)
        .post('/api/disputes/1/messages')
        .set('Authorization', 'Bearer agent-owner-token')
        .send({ content: 'I believe my work meets all requirements. Please review the test results.' });

      expect(messageResponse1.status).toBe(201);
      expect(messageResponse1.body.content).toContain('meets all requirements');

      // Step 4: Poster replies
      const message2 = {
        id: 2,
        disputeId: 1,
        senderId: 'poster-id',
        content: 'The tests are passing but feature X is not implemented as specified.',
        attachments: [],
        isInternal: false,
        createdAt: new Date(),
      };

      mockStorage.createDisputeMessage.mockResolvedValue(message2);

      const messageResponse2 = await request(app)
        .post('/api/disputes/1/messages')
        .set('Authorization', 'Bearer poster-token')
        .send({ content: 'The tests are passing but feature X is not implemented as specified.' });

      expect(messageResponse2.status).toBe(201);

      // Step 5: Admin reviews and updates status
      const underReviewDispute = { ...createdDispute, status: 'under_review', assignedTo: 'admin-id' };
      mockStorage.updateDispute.mockResolvedValue(underReviewDispute);

      const statusResponse = await request(app)
        .patch('/api/disputes/1/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'under_review', assignedTo: 'admin-id' });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe('under_review');
      expect(statusResponse.body.assignedTo).toBe('admin-id');

      // Step 6: Admin resolves dispute with partial refund
      const resolvedDispute = {
        ...underReviewDispute,
        status: 'resolved',
        resolution: 'partial_refund',
        resolutionNotes: 'Agent completed most requirements but missed feature X. 50% refund issued.',
      };

      mockStorage.getDispute.mockResolvedValue(underReviewDispute);
      mockStorage.updateDispute.mockResolvedValue(resolvedDispute);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStripeService.refundPayment.mockResolvedValue({});

      const resolveResponse = await request(app)
        .post('/api/disputes/1/resolve')
        .set('Authorization', 'Bearer admin-token')
        .send({
          resolution: 'partial_refund',
          resolutionNotes: 'Agent completed most requirements but missed feature X. 50% refund issued.',
          action: 'partial_refund',
          refundAmount: 250,
        });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.dispute.status).toBe('resolved');
      expect(resolveResponse.body.dispute.resolution).toBe('partial_refund');
      expect(resolveResponse.body.paymentAction).toBe('partial_refund');
      expect(mockStripeService.refundPayment).toHaveBeenCalledWith('pi_test123', 250);
    });

    it('should handle agent-initiated dispute with full refund resolution', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'poster-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test456',
        reward: '300.00',
      });
      const agent = createAgent({ id: 1, developerId: 'agent-owner-id' });
      const submission = createSubmission({ id: 1, bountyId: 1, agentId: 1 });

      // Agent creates dispute about scope change
      const disputeData = {
        bountyId: 1,
        submissionId: 1,
        category: 'scope',
        title: 'Requirements changed after submission',
        description: 'The bounty requirements were modified after I submitted my work',
      };

      const createdDispute = createDispute({
        id: 1,
        ...disputeData,
        initiatorId: 'agent-owner-id',
        respondentId: 'poster-id',
      });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.createDispute.mockResolvedValue(createdDispute);
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const createResponse = await request(app)
        .post('/api/disputes')
        .set('Authorization', 'Bearer agent-owner-token')
        .send(disputeData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.initiatorId).toBe('agent-owner-id');
      expect(createResponse.body.respondentId).toBe('poster-id');

      // Admin resolves in favor of poster (full refund)
      const resolvedDispute = {
        ...createdDispute,
        status: 'resolved',
        resolution: 'favor_poster',
      };

      mockStorage.getDispute.mockResolvedValue(createdDispute);
      mockStorage.updateDispute.mockResolvedValue(resolvedDispute);
      mockStripeService.refundPayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue({});
      mockStorage.updateBountyStatus.mockResolvedValue({});

      const resolveResponse = await request(app)
        .post('/api/disputes/1/resolve')
        .set('Authorization', 'Bearer admin-token')
        .send({
          resolution: 'favor_poster',
          resolutionNotes: 'Poster provided evidence that requirements were clear from the start',
          action: 'refund',
        });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.paymentAction).toBe('refunded');
      expect(mockStripeService.refundPayment).toHaveBeenCalledWith('pi_test456');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'refunded');
      expect(mockStorage.updateBountyStatus).toHaveBeenCalledWith(1, 'cancelled');
    });

    it('should handle resolution in favor of agent with payment release', async () => {
      const bounty = createBounty({
        id: 1,
        posterId: 'poster-id',
        status: 'in_progress',
        paymentStatus: 'funded',
        stripePaymentIntentId: 'pi_test789',
      });

      const dispute = createDispute({
        id: 1,
        bountyId: 1,
        initiatorId: 'poster-id',
        respondentId: 'agent-owner-id',
        status: 'under_review',
      });

      const resolvedDispute = {
        ...dispute,
        status: 'resolved',
        resolution: 'favor_agent',
      };

      mockStorage.getDispute.mockResolvedValue(dispute);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.updateDispute.mockResolvedValue(resolvedDispute);
      mockStripeService.capturePayment.mockResolvedValue({});
      mockStorage.updateBountyPaymentStatus.mockResolvedValue({});
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const resolveResponse = await request(app)
        .post('/api/disputes/1/resolve')
        .set('Authorization', 'Bearer admin-token')
        .send({
          resolution: 'favor_agent',
          resolutionNotes: 'Agent work meets all original requirements',
          action: 'release',
        });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.paymentAction).toBe('released');
      expect(mockStripeService.capturePayment).toHaveBeenCalledWith('pi_test789');
      expect(mockStorage.updateBountyPaymentStatus).toHaveBeenCalledWith(1, 'released');
    });
  });

  describe('Dispute Escalation', () => {
    it('should allow involved parties to escalate dispute priority', async () => {
      const dispute = createDispute({
        id: 1,
        bountyId: 1,
        initiatorId: 'poster-id',
        respondentId: 'agent-owner-id',
        priority: 'medium',
        status: 'open',
      });

      const escalatedDispute = { ...dispute, priority: 'high' };

      mockStorage.getDispute.mockResolvedValue(dispute);
      mockStorage.updateDispute.mockResolvedValue(escalatedDispute);
      mockStorage.createDisputeMessage.mockResolvedValue({});
      mockStorage.addTimelineEvent.mockResolvedValue({});

      const response = await request(app)
        .post('/api/disputes/1/escalate')
        .set('Authorization', 'Bearer poster-token')
        .send({ reason: 'No response in 48 hours' });

      expect(response.status).toBe(200);
      expect(response.body.priority).toBe('high');
      expect(mockStorage.createDisputeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('escalated to high priority'),
        })
      );
    });

    it('should prevent escalation beyond urgent priority', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'poster-id',
        respondentId: 'agent-owner-id',
        priority: 'urgent',
        status: 'open',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .post('/api/disputes/1/escalate')
        .set('Authorization', 'Bearer poster-token')
        .send({ reason: 'Urgent attention needed' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Dispute is already at highest priority');
    });

    it('should prevent non-involved parties from escalating', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'other-user-id',
        respondentId: 'another-user-id',
        priority: 'low',
        status: 'open',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .post('/api/disputes/1/escalate')
        .set('Authorization', 'Bearer poster-token')
        .send({ reason: 'I want to escalate' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to escalate this dispute');
    });
  });

  describe('Dispute Messages', () => {
    it('should allow involved parties to add messages', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'poster-id',
        respondentId: 'agent-owner-id',
        status: 'open',
      });

      const message = {
        id: 1,
        disputeId: 1,
        senderId: 'poster-id',
        content: 'Here is additional evidence',
        attachments: ['file1.pdf'],
        isInternal: false,
        createdAt: new Date(),
      };

      mockStorage.getDispute.mockResolvedValue(dispute);
      mockStorage.createDisputeMessage.mockResolvedValue(message);

      const response = await request(app)
        .post('/api/disputes/1/messages')
        .set('Authorization', 'Bearer poster-token')
        .send({ content: 'Here is additional evidence', attachments: ['file1.pdf'] });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('Here is additional evidence');
    });

    it('should reject empty messages', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'poster-id',
        status: 'open',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .post('/api/disputes/1/messages')
        .set('Authorization', 'Bearer poster-token')
        .send({ content: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Message content is required');
    });

    it('should prevent messages on resolved disputes', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'poster-id',
        status: 'resolved',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .post('/api/disputes/1/messages')
        .set('Authorization', 'Bearer poster-token')
        .send({ content: 'Want to add more' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot add messages to resolved or closed disputes');
    });

    it('should prevent non-involved parties from messaging', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'other-user-id',
        respondentId: 'another-user-id',
        status: 'open',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .post('/api/disputes/1/messages')
        .set('Authorization', 'Bearer poster-token')
        .send({ content: 'I want to comment' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to message in this dispute');
    });
  });

  describe('Dispute Access Control', () => {
    it('should prevent viewing disputes by non-involved parties', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'other-user-id',
        respondentId: 'another-user-id',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .get('/api/disputes/1')
        .set('Authorization', 'Bearer poster-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to view this dispute');
    });

    it('should allow admins to view any dispute', async () => {
      const dispute = createDispute({
        id: 1,
        initiatorId: 'other-user-id',
        respondentId: 'another-user-id',
      });

      mockStorage.getDispute.mockResolvedValue(dispute);
      mockStorage.getDisputeMessages.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/disputes/1')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
    });

    it('should require admin for status updates', async () => {
      const dispute = createDispute({ id: 1 });
      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .patch('/api/disputes/1/status')
        .set('Authorization', 'Bearer poster-token')
        .send({ status: 'under_review' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });

    it('should require admin for dispute resolution', async () => {
      const response = await request(app)
        .post('/api/disputes/1/resolve')
        .set('Authorization', 'Bearer poster-token')
        .send({ resolution: 'favor_poster' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });
  });

  describe('Dispute Validation', () => {
    it('should reject dispute creation with invalid category', async () => {
      const bounty = createBounty({ id: 1, posterId: 'poster-id' });
      const submission = createSubmission({ id: 1, bountyId: 1, agentId: 1 });
      const agent = createAgent({ id: 1, developerId: 'agent-owner-id' });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', 'Bearer poster-token')
        .send({
          bountyId: 1,
          submissionId: 1,
          category: 'invalid_category',
          title: 'Test',
          description: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid dispute category');
    });

    it('should reject dispute creation by unrelated user', async () => {
      const bounty = createBounty({ id: 1, posterId: 'other-poster-id' });
      const submission = createSubmission({ id: 1, bountyId: 1, agentId: 1 });
      const agent = createAgent({ id: 1, developerId: 'other-agent-owner-id' });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);

      const response = await request(app)
        .post('/api/disputes')
        .set('Authorization', 'Bearer poster-token')
        .send({
          bountyId: 1,
          submissionId: 1,
          category: 'quality',
          title: 'Test',
          description: 'Test',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only bounty poster or agent owner can create disputes');
    });

    it('should reject invalid resolution type', async () => {
      const dispute = createDispute({ id: 1, status: 'open', bountyId: 1 });
      const bounty = createBounty({ id: 1 });

      mockStorage.getDispute.mockResolvedValue(dispute);
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/disputes/1/resolve')
        .set('Authorization', 'Bearer admin-token')
        .send({ resolution: 'invalid_resolution' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid resolution type');
    });

    it('should reject resolution of already resolved disputes', async () => {
      const dispute = createDispute({ id: 1, status: 'resolved', bountyId: 1 });
      mockStorage.getDispute.mockResolvedValue(dispute);

      const response = await request(app)
        .post('/api/disputes/1/resolve')
        .set('Authorization', 'Bearer admin-token')
        .send({ resolution: 'favor_poster' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Dispute is already resolved or closed');
    });
  });

  describe('Bounty Disputes Endpoint', () => {
    it('should return disputes for bounty to poster', async () => {
      const bounty = createBounty({ id: 1, posterId: 'poster-id' });
      const disputes = [
        createDispute({ id: 1, bountyId: 1 }),
        createDispute({ id: 2, bountyId: 1 }),
      ];

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getDisputesByBounty.mockResolvedValue(disputes);

      const response = await request(app)
        .get('/api/bounties/1/disputes')
        .set('Authorization', 'Bearer poster-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return disputes for bounty to admin', async () => {
      const bounty = createBounty({ id: 1, posterId: 'other-poster-id' });
      const disputes = [createDispute({ id: 1, bountyId: 1 })];

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getDisputesByBounty.mockResolvedValue(disputes);

      const response = await request(app)
        .get('/api/bounties/1/disputes')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('should deny access to non-poster non-admin', async () => {
      const bounty = createBounty({ id: 1, posterId: 'other-poster-id' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .get('/api/bounties/1/disputes')
        .set('Authorization', 'Bearer agent-owner-token');

      expect(response.status).toBe(403);
    });
  });

  describe('User Disputes Endpoint', () => {
    it('should return user disputes', async () => {
      const disputes = [
        createDispute({ id: 1, initiatorId: 'poster-id' }),
        createDispute({ id: 2, respondentId: 'poster-id' }),
      ];

      mockStorage.getDisputesByUser.mockResolvedValue(disputes);

      const response = await request(app)
        .get('/api/disputes')
        .set('Authorization', 'Bearer poster-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });
});
