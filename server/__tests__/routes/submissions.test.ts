/**
 * Submissions Routes Tests - Core API endpoints for submission management
 *
 * Tests the submission CRUD operations and workflows:
 * - POST /api/bounties/:id/submissions - Create submission (requires auth)
 * - PATCH /api/submissions/:id - Update submission (requires agent ownership)
 * - POST /api/submissions/:id/reviews - Create review
 * - POST /api/submissions/:id/verify - Trigger AI verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createBounty, createAgent, createSubmission, createReview, resetIdCounter } from '../factories';

// Mock storage
const mockStorage = {
  getBounty: vi.fn(),
  getAgent: vi.fn(),
  getAgentsByDeveloper: vi.fn(),
  createSubmission: vi.fn(),
  getSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  createReview: vi.fn(),
  getReviewsBySubmission: vi.fn(),
};

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

// Mock verification service
const mockVerificationService = {
  createAudit: vi.fn(),
  runAiVerification: vi.fn(),
  getAudit: vi.fn(),
};

vi.mock('../../verificationService', () => ({
  verificationService: mockVerificationService,
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

// Create a minimal test app with submission routes
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

  // POST /api/bounties/:id/submissions
  app.post('/api/bounties/:id/submissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const bountyId = parseInt(req.params.id);
      const { agentId, output } = req.body;

      if (!agentId || typeof agentId !== 'number') {
        return res.status(400).json({ message: 'Valid agentId is required' });
      }

      const bounty = await mockStorage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      // Check bounty is open for submissions
      if (bounty.status !== 'open' && bounty.status !== 'in_progress') {
        return res.status(400).json({ message: 'Bounty is not open for submissions' });
      }

      // Verify agent exists and belongs to user
      const agent = await mockStorage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      if (agent.developerId !== userId) {
        return res.status(403).json({ message: 'You can only submit with your own agents' });
      }

      const submission = await mockStorage.createSubmission({
        bountyId,
        agentId,
        output: output || null,
        status: 'pending',
        progress: 0,
      });

      res.status(201).json(submission);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create submission' });
    }
  });

  // PATCH /api/submissions/:id
  app.patch('/api/submissions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const submissionId = parseInt(req.params.id);
      const { status, progress, output } = req.body;

      const submission = await mockStorage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      // Get the agent to verify ownership
      const agent = await mockStorage.getAgent(submission.agentId);
      if (!agent) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      if (agent.developerId !== userId) {
        return res.status(403).json({ message: 'You can only update your own submissions' });
      }

      const updateData: any = {};
      if (status !== undefined) updateData.status = status;
      if (progress !== undefined) updateData.progress = progress;
      if (output !== undefined) updateData.output = output;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided' });
      }

      const updated = await mockStorage.updateSubmission(submissionId, updateData);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update submission' });
    }
  });

  // POST /api/submissions/:id/reviews
  app.post('/api/submissions/:id/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const submissionId = parseInt(req.params.id);
      const { rating, comment } = req.body;

      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
      }

      const submission = await mockStorage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      // Get bounty to verify user is the poster
      const bounty = await mockStorage.getBounty(submission.bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can review submissions' });
      }

      const review = await mockStorage.createReview({
        submissionId,
        reviewerId: userId,
        rating,
        comment: comment || null,
      });

      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create review' });
    }
  });

  // POST /api/submissions/:id/verify
  app.post('/api/submissions/:id/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const submissionId = parseInt(req.params.id);

      const submission = await mockStorage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }

      // Get bounty to verify user is the poster
      const bounty = await mockStorage.getBounty(submission.bountyId);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }

      if (bounty.posterId !== userId) {
        return res.status(403).json({ message: 'Only the bounty poster can trigger verification' });
      }

      // Create audit record
      const audit = await mockVerificationService.createAudit({
        submissionId,
        type: 'ai_verification',
        status: 'pending',
      });

      // Trigger AI verification (async - we don't wait for it)
      mockVerificationService.runAiVerification(audit.id, submission, bounty).catch(() => {
        // Errors handled internally
      });

      res.status(202).json({
        message: 'AI verification triggered',
        auditId: audit.id,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to trigger verification' });
    }
  });

  return app;
}

describe('Submissions Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    app = createTestApp();
  });

  describe('POST /api/bounties/:id/submissions', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .send({ agentId: 1 });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized');
      expect(mockStorage.createSubmission).not.toHaveBeenCalled();
    });

    it('should check bounty is open for submissions', async () => {
      const bounty = createBounty({ id: 1, status: 'completed' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not open for submissions');
    });

    it('should allow submission when bounty is open', async () => {
      const bounty = createBounty({ id: 1, status: 'open' });
      const agent = createAgent({ id: 1, developerId: 'test-user-id' });
      const submission = createSubmission({ id: 1, bountyId: 1, agentId: 1 });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.createSubmission.mockResolvedValue(submission);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 1 });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(1);
      expect(mockStorage.createSubmission).toHaveBeenCalled();
    });

    it('should allow submission when bounty is in_progress', async () => {
      const bounty = createBounty({ id: 1, status: 'in_progress' });
      const agent = createAgent({ id: 1, developerId: 'test-user-id' });
      const submission = createSubmission({ id: 1, bountyId: 1, agentId: 1 });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.createSubmission.mockResolvedValue(submission);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 1 });

      expect(response.status).toBe(201);
    });

    it('should reject submission when bounty is cancelled', async () => {
      const bounty = createBounty({ id: 1, status: 'cancelled' });
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bounty is not open for submissions');
    });

    it('should validate agentId is required', async () => {
      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Valid agentId is required');
    });

    it('should reject if agent not found', async () => {
      const bounty = createBounty({ id: 1, status: 'open' });
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getAgent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 999 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Agent not found');
    });

    it('should reject if agent belongs to another user', async () => {
      const bounty = createBounty({ id: 1, status: 'open' });
      const agent = createAgent({ id: 1, developerId: 'other-user-id' });

      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.getAgent.mockResolvedValue(agent);

      const response = await request(app)
        .post('/api/bounties/1/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 1 });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('You can only submit with your own agents');
    });

    it('should return 404 if bounty not found', async () => {
      mockStorage.getBounty.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/bounties/999/submissions')
        .set('Authorization', 'Bearer valid-token')
        .send({ agentId: 1 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Bounty not found');
    });
  });

  describe('PATCH /api/submissions/:id', () => {
    it('should require agent ownership', async () => {
      const submission = createSubmission({ id: 1, agentId: 1 });
      const agent = createAgent({ id: 1, developerId: 'other-user-id' });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);

      const response = await request(app)
        .patch('/api/submissions/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'submitted', progress: 100 });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('You can only update your own submissions');
    });

    it('should allow owner to update submission', async () => {
      const submission = createSubmission({ id: 1, agentId: 1, status: 'pending' });
      const agent = createAgent({ id: 1, developerId: 'test-user-id' });
      const updatedSubmission = { ...submission, status: 'submitted', progress: 100 };

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.updateSubmission.mockResolvedValue(updatedSubmission);

      const response = await request(app)
        .patch('/api/submissions/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'submitted', progress: 100 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('submitted');
      expect(response.body.progress).toBe(100);
      expect(mockStorage.updateSubmission).toHaveBeenCalledWith(1, { status: 'submitted', progress: 100 });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/submissions/1')
        .send({ status: 'submitted' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized');
    });

    it('should return 404 if submission not found', async () => {
      mockStorage.getSubmission.mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/submissions/999')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'submitted' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Submission not found');
    });

    it('should reject if no update data provided', async () => {
      const submission = createSubmission({ id: 1, agentId: 1 });
      const agent = createAgent({ id: 1, developerId: 'test-user-id' });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);

      const response = await request(app)
        .patch('/api/submissions/1')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No update data provided');
    });

    it('should update output field', async () => {
      const submission = createSubmission({ id: 1, agentId: 1 });
      const agent = createAgent({ id: 1, developerId: 'test-user-id' });
      const updatedSubmission = { ...submission, output: 'Task completed successfully' };

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getAgent.mockResolvedValue(agent);
      mockStorage.updateSubmission.mockResolvedValue(updatedSubmission);

      const response = await request(app)
        .patch('/api/submissions/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ output: 'Task completed successfully' });

      expect(response.status).toBe(200);
      expect(response.body.output).toBe('Task completed successfully');
    });
  });

  describe('POST /api/submissions/:id/reviews', () => {
    it('should create review successfully', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });
      const review = createReview({ id: 1, submissionId: 1, rating: 5 });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.createReview.mockResolvedValue(review);

      const response = await request(app)
        .post('/api/submissions/1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send({ rating: 5, comment: 'Excellent work!' });

      expect(response.status).toBe(201);
      expect(response.body.rating).toBe(5);
      expect(mockStorage.createReview).toHaveBeenCalledWith({
        submissionId: 1,
        reviewerId: 'test-user-id',
        rating: 5,
        comment: 'Excellent work!',
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/submissions/1/reviews')
        .send({ rating: 5 });

      expect(response.status).toBe(401);
    });

    it('should validate rating is between 1 and 5', async () => {
      const response = await request(app)
        .post('/api/submissions/1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send({ rating: 6 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Rating must be a number between 1 and 5');
    });

    it('should reject rating of 0', async () => {
      const response = await request(app)
        .post('/api/submissions/1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send({ rating: 0 });

      expect(response.status).toBe(400);
    });

    it('should only allow bounty poster to review', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const bounty = createBounty({ id: 1, posterId: 'other-user-id' });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/submissions/1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send({ rating: 5 });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can review submissions');
    });

    it('should return 404 if submission not found', async () => {
      mockStorage.getSubmission.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/submissions/999/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send({ rating: 5 });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Submission not found');
    });

    it('should allow review without comment', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });
      const review = createReview({ id: 1, submissionId: 1, rating: 4, comment: null });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockStorage.createReview.mockResolvedValue(review);

      const response = await request(app)
        .post('/api/submissions/1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send({ rating: 4 });

      expect(response.status).toBe(201);
      expect(mockStorage.createReview).toHaveBeenCalledWith({
        submissionId: 1,
        reviewerId: 'test-user-id',
        rating: 4,
        comment: null,
      });
    });
  });

  describe('POST /api/submissions/:id/verify', () => {
    it('should trigger AI verification', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1, output: 'My solution' });
      const bounty = createBounty({ id: 1, posterId: 'test-user-id' });
      const audit = { id: 1, submissionId: 1, type: 'ai_verification', status: 'pending' };

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);
      mockVerificationService.createAudit.mockResolvedValue(audit);
      mockVerificationService.runAiVerification.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/submissions/1/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(202);
      expect(response.body.message).toBe('AI verification triggered');
      expect(response.body.auditId).toBe(1);
      expect(mockVerificationService.createAudit).toHaveBeenCalled();
      expect(mockVerificationService.runAiVerification).toHaveBeenCalledWith(1, submission, bounty);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/submissions/1/verify');

      expect(response.status).toBe(401);
    });

    it('should only allow bounty poster to trigger verification', async () => {
      const submission = createSubmission({ id: 1, bountyId: 1 });
      const bounty = createBounty({ id: 1, posterId: 'other-user-id' });

      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(bounty);

      const response = await request(app)
        .post('/api/submissions/1/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the bounty poster can trigger verification');
    });

    it('should return 404 if submission not found', async () => {
      mockStorage.getSubmission.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/submissions/999/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Submission not found');
    });

    it('should return 404 if bounty not found', async () => {
      const submission = createSubmission({ id: 1, bountyId: 999 });
      mockStorage.getSubmission.mockResolvedValue(submission);
      mockStorage.getBounty.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/submissions/1/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Bounty not found');
    });
  });
});
