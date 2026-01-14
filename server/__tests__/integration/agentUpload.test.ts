/**
 * Agent Upload Integration Tests
 *
 * Tests complete end-to-end flows for agent upload operations:
 * - Agent upload: create → test → publish → marketplace listing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createAgent, createAgentUpload, resetIdCounter } from '../factories';

// Mock storage with agent upload lifecycle support
const mockStorage = {
  // Agent upload operations
  createAgentUpload: vi.fn(),
  getAgentUpload: vi.fn(),
  updateAgentUpload: vi.fn(),
  getAgentUploadsByDeveloper: vi.fn(),
  getPublishedAgentUploads: vi.fn(),
  deleteAgentUpload: vi.fn(),
  // Agent operations (for marketplace)
  createAgent: vi.fn(),
  getAgent: vi.fn(),
  getAllAgents: vi.fn(),
  getTopAgents: vi.fn(),
  // Test runs
  createTestRun: vi.fn(),
  getTestRunsByAgentUpload: vi.fn(),
  updateTestRun: vi.fn(),
};

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

// Mock AI execution service for testing agents
const mockExecutionService = {
  executeAgent: vi.fn(),
  createExecutionRun: vi.fn(),
  executeRun: vi.fn(),
  getRunStatus: vi.fn(),
};

vi.mock('../../aiExecutionService', () => ({
  aiExecutionService: mockExecutionService,
}));

// Mock sandbox runner for code testing
const mockSandboxRunner = {
  executeCode: vi.fn(),
  testSandbox: vi.fn(),
};

vi.mock('../../sandboxRunner', () => mockSandboxRunner);

// Mock auth
vi.mock('../../replit_integrations/auth', () => ({
  setupAuth: vi.fn().mockResolvedValue(undefined),
  registerAuthRoutes: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer developer-token') {
      req.user = { claims: { sub: 'developer-id', email: 'dev@example.com', name: 'Developer' } };
      next();
    } else if (req.headers.authorization === 'Bearer other-developer-token') {
      req.user = { claims: { sub: 'other-developer-id', email: 'other@example.com', name: 'Other Dev' } };
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
 * Create test app with agent upload routes
 */
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Auth middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer developer-token') {
      req.user = { claims: { sub: 'developer-id', email: 'dev@example.com', name: 'Developer' } };
      next();
    } else if (req.headers.authorization === 'Bearer other-developer-token') {
      req.user = { claims: { sub: 'other-developer-id', email: 'other@example.com', name: 'Other Dev' } };
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

  // POST /api/agent-uploads - Create a new agent upload (draft)
  app.post('/api/agent-uploads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { name, description, uploadType, prompt, configJson, repoUrl, entryPoint, runtime, capabilities, targetCategories, price } = req.body;

      // Validation
      if (!name || !description) {
        return res.status(400).json({ message: 'Name and description are required' });
      }

      const validUploadTypes = ['no_code', 'low_code', 'full_code'];
      if (uploadType && !validUploadTypes.includes(uploadType)) {
        return res.status(400).json({ message: 'Invalid upload type' });
      }

      // Validate based on upload type
      if (uploadType === 'no_code' && !prompt) {
        return res.status(400).json({ message: 'Prompt is required for no-code agents' });
      }

      if (uploadType === 'low_code' && !configJson) {
        return res.status(400).json({ message: 'Configuration is required for low-code agents' });
      }

      if (uploadType === 'full_code') {
        if (!repoUrl && !entryPoint) {
          return res.status(400).json({ message: 'Repository URL or entry point is required for full-code agents' });
        }
      }

      const agentUpload = await mockStorage.createAgentUpload({
        name,
        description,
        uploadType: uploadType || 'no_code',
        status: 'draft',
        developerId: userId,
        prompt: prompt || null,
        configJson: configJson || null,
        repoUrl: repoUrl || null,
        entryPoint: entryPoint || null,
        runtime: runtime || 'nodejs',
        capabilities: capabilities || [],
        targetCategories: targetCategories || [],
        price: price || '0',
        isPublic: false,
      });

      res.status(201).json(agentUpload);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create agent upload' });
    }
  });

  // GET /api/agent-uploads/mine - Get developer's agent uploads (must be before :id route)
  app.get('/api/agent-uploads/mine', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploads = await mockStorage.getAgentUploadsByDeveloper(userId);
      res.json(uploads);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch agent uploads' });
    }
  });

  // GET /api/agent-uploads/:id - Get agent upload details
  app.get('/api/agent-uploads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      // Only owner or admin can view drafts
      const isAdmin = req.headers.authorization === 'Bearer admin-token';
      if (agentUpload.status === 'draft' && agentUpload.developerId !== userId && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to view this agent upload' });
      }

      res.json(agentUpload);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch agent upload' });
    }
  });

  // PATCH /api/agent-uploads/:id - Update agent upload
  app.patch('/api/agent-uploads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      if (agentUpload.developerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this agent upload' });
      }

      // Cannot update published agents
      if (agentUpload.status === 'published') {
        return res.status(400).json({ message: 'Cannot update published agents. Create a new version instead.' });
      }

      const updatedUpload = await mockStorage.updateAgentUpload(uploadId, req.body);
      res.json(updatedUpload);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update agent upload' });
    }
  });

  // POST /api/agent-uploads/:id/test - Run tests on agent upload
  app.post('/api/agent-uploads/:id/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);
      const { testInput, testCases } = req.body;

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      if (agentUpload.developerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to test this agent' });
      }

      // Create test run record
      const testRun = await mockStorage.createTestRun({
        agentUploadId: uploadId,
        status: 'running',
        input: testInput || 'Default test input',
        testCases: testCases || [],
        startedAt: new Date(),
      });

      // Execute the test based on upload type
      let result;
      if (agentUpload.uploadType === 'no_code') {
        // For no-code, test the prompt with AI execution
        result = await mockExecutionService.executeAgent(uploadId, testInput || 'Test query');
      } else if (agentUpload.uploadType === 'low_code') {
        // For low-code, test the config steps
        result = await mockSandboxRunner.executeCode(
          JSON.stringify(agentUpload.configJson),
          { input: testInput }
        );
      } else {
        // For full-code, run sandbox test
        result = await mockSandboxRunner.testSandbox();
      }

      // Update test run with results
      const passed = result.success || result.status === 'completed';
      const completedTestRun = await mockStorage.updateTestRun(testRun.id, {
        status: passed ? 'passed' : 'failed',
        output: result.output || result.result,
        error: result.error || null,
        completedAt: new Date(),
      });

      // Update agent upload test stats
      const newTotalTests = agentUpload.totalTests + 1;
      const newPassedTests = agentUpload.passedTests + (passed ? 1 : 0);
      const newSuccessRate = ((newPassedTests / newTotalTests) * 100).toFixed(2);

      await mockStorage.updateAgentUpload(uploadId, {
        totalTests: newTotalTests,
        passedTests: newPassedTests,
        successRate: newSuccessRate,
      });

      res.json({
        testRun: completedTestRun,
        passed,
        successRate: newSuccessRate,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to run test' });
    }
  });

  // GET /api/agent-uploads/:id/tests - Get test history for agent upload
  app.get('/api/agent-uploads/:id/tests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      if (agentUpload.developerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to view test history' });
      }

      const testRuns = await mockStorage.getTestRunsByAgentUpload(uploadId);
      res.json(testRuns);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch test history' });
    }
  });

  // POST /api/agent-uploads/:id/publish - Publish agent to marketplace
  app.post('/api/agent-uploads/:id/publish', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      if (agentUpload.developerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to publish this agent' });
      }

      if (agentUpload.status === 'published') {
        return res.status(400).json({ message: 'Agent is already published' });
      }

      // Check minimum requirements for publishing
      if (agentUpload.totalTests < 1) {
        return res.status(400).json({ message: 'Agent must have at least one passing test before publishing' });
      }

      if (parseFloat(agentUpload.successRate) < 50) {
        return res.status(400).json({ message: 'Agent must have at least 50% test success rate before publishing' });
      }

      // Create marketplace agent entry
      const marketplaceAgent = await mockStorage.createAgent({
        name: agentUpload.name,
        description: agentUpload.description,
        capabilities: agentUpload.capabilities,
        developerId: userId,
        avatarColor: agentUpload.avatarColor,
        isVerified: false,
        uploadId: uploadId,
      });

      // Update agent upload status
      const publishedUpload = await mockStorage.updateAgentUpload(uploadId, {
        status: 'published',
        isPublic: true,
        publishedAt: new Date(),
        marketplaceAgentId: marketplaceAgent.id,
      });

      res.json({
        agentUpload: publishedUpload,
        marketplaceAgent,
        message: 'Agent published successfully to marketplace',
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to publish agent' });
    }
  });

  // POST /api/agent-uploads/:id/unpublish - Unpublish agent from marketplace
  app.post('/api/agent-uploads/:id/unpublish', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      if (agentUpload.developerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to unpublish this agent' });
      }

      if (agentUpload.status !== 'published') {
        return res.status(400).json({ message: 'Agent is not published' });
      }

      const unpublishedUpload = await mockStorage.updateAgentUpload(uploadId, {
        status: 'draft',
        isPublic: false,
      });

      res.json({
        agentUpload: unpublishedUpload,
        message: 'Agent unpublished from marketplace',
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to unpublish agent' });
    }
  });

  // DELETE /api/agent-uploads/:id - Delete agent upload
  app.delete('/api/agent-uploads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const uploadId = parseInt(req.params.id);

      const agentUpload = await mockStorage.getAgentUpload(uploadId);
      if (!agentUpload) {
        return res.status(404).json({ message: 'Agent upload not found' });
      }

      if (agentUpload.developerId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this agent' });
      }

      if (agentUpload.status === 'published') {
        return res.status(400).json({ message: 'Cannot delete published agents. Unpublish first.' });
      }

      await mockStorage.deleteAgentUpload(uploadId);
      res.json({ message: 'Agent upload deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete agent upload' });
    }
  });

  // GET /api/marketplace/agents - Get all published agents
  app.get('/api/marketplace/agents', async (req, res) => {
    try {
      const { category, sort, limit } = req.query;
      const agents = await mockStorage.getPublishedAgentUploads({
        category: category as string,
        sort: sort as string,
        limit: parseInt(limit as string) || 20,
      });
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch marketplace agents' });
    }
  });

  return app;
}

describe('Agent Upload Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    app = createTestApp();
  });

  describe('Agent Upload Flow: create → test → publish → marketplace listing', () => {
    it('should complete full agent upload lifecycle - no-code agent', async () => {
      // Step 1: Create agent upload (draft)
      const uploadData = {
        name: 'Customer Support Bot',
        description: 'AI agent for handling customer inquiries',
        uploadType: 'no_code',
        prompt: 'You are a helpful customer support agent. Answer user questions professionally.',
        capabilities: ['customer-support', 'faq'],
        targetCategories: ['support', 'chat'],
        price: '9.99',
      };

      const createdUpload = createAgentUpload({
        id: 1,
        ...uploadData,
        developerId: 'developer-id',
        status: 'draft',
        totalTests: 0,
        passedTests: 0,
        successRate: '0',
      });

      mockStorage.createAgentUpload.mockResolvedValue(createdUpload);

      const createResponse = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send(uploadData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.name).toBe('Customer Support Bot');
      expect(createResponse.body.status).toBe('draft');
      expect(createResponse.body.uploadType).toBe('no_code');

      // Step 2: Run tests on the agent
      const testRun = {
        id: 1,
        agentUploadId: 1,
        status: 'running',
        input: 'What are your business hours?',
        startedAt: new Date(),
      };

      const completedTestRun = {
        ...testRun,
        status: 'passed',
        output: 'Our business hours are Monday through Friday, 9 AM to 5 PM.',
        completedAt: new Date(),
      };

      mockStorage.getAgentUpload.mockResolvedValue(createdUpload);
      mockStorage.createTestRun.mockResolvedValue(testRun);
      mockExecutionService.executeAgent.mockResolvedValue({
        success: true,
        status: 'completed',
        output: 'Our business hours are Monday through Friday, 9 AM to 5 PM.',
      });
      mockStorage.updateTestRun.mockResolvedValue(completedTestRun);
      mockStorage.updateAgentUpload.mockResolvedValue({
        ...createdUpload,
        totalTests: 1,
        passedTests: 1,
        successRate: '100.00',
      });

      const testResponse = await request(app)
        .post('/api/agent-uploads/1/test')
        .set('Authorization', 'Bearer developer-token')
        .send({ testInput: 'What are your business hours?' });

      expect(testResponse.status).toBe(200);
      expect(testResponse.body.passed).toBe(true);
      expect(testResponse.body.successRate).toBe('100.00');
      expect(mockExecutionService.executeAgent).toHaveBeenCalledWith(1, 'What are your business hours?');

      // Step 3: Publish to marketplace
      const testedUpload = {
        ...createdUpload,
        totalTests: 1,
        passedTests: 1,
        successRate: '100.00',
      };

      const marketplaceAgent = createAgent({
        id: 1,
        name: 'Customer Support Bot',
        description: 'AI agent for handling customer inquiries',
        developerId: 'developer-id',
        capabilities: ['customer-support', 'faq'],
      });

      const publishedUpload = {
        ...testedUpload,
        status: 'published',
        isPublic: true,
        publishedAt: new Date(),
        marketplaceAgentId: 1,
      };

      mockStorage.getAgentUpload.mockResolvedValue(testedUpload);
      mockStorage.createAgent.mockResolvedValue(marketplaceAgent);
      mockStorage.updateAgentUpload.mockResolvedValue(publishedUpload);

      const publishResponse = await request(app)
        .post('/api/agent-uploads/1/publish')
        .set('Authorization', 'Bearer developer-token');

      expect(publishResponse.status).toBe(200);
      expect(publishResponse.body.agentUpload.status).toBe('published');
      expect(publishResponse.body.agentUpload.isPublic).toBe(true);
      expect(publishResponse.body.marketplaceAgent.name).toBe('Customer Support Bot');
      expect(publishResponse.body.message).toBe('Agent published successfully to marketplace');

      // Step 4: Verify agent appears in marketplace
      mockStorage.getPublishedAgentUploads.mockResolvedValue([publishedUpload]);

      const marketplaceResponse = await request(app)
        .get('/api/marketplace/agents')
        .query({ category: 'support' });

      expect(marketplaceResponse.status).toBe(200);
      expect(marketplaceResponse.body).toHaveLength(1);
      expect(marketplaceResponse.body[0].name).toBe('Customer Support Bot');
      expect(marketplaceResponse.body[0].isPublic).toBe(true);
    });

    it('should complete full agent upload lifecycle - low-code agent', async () => {
      // Create low-code agent with config
      const configJson = {
        steps: [
          { type: 'input', name: 'user_query' },
          { type: 'ai', prompt: 'Process: {{user_query}}' },
          { type: 'output', format: 'json' },
        ],
      };

      const uploadData = {
        name: 'Data Processor',
        description: 'Low-code agent for processing data',
        uploadType: 'low_code',
        configJson,
        capabilities: ['data-processing'],
        targetCategories: ['automation'],
      };

      const createdUpload = createAgentUpload({
        id: 1,
        ...uploadData,
        developerId: 'developer-id',
        status: 'draft',
      });

      mockStorage.createAgentUpload.mockResolvedValue(createdUpload);

      const createResponse = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send(uploadData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.uploadType).toBe('low_code');

      // Test the low-code agent
      mockStorage.getAgentUpload.mockResolvedValue(createdUpload);
      mockStorage.createTestRun.mockResolvedValue({ id: 1 });
      mockSandboxRunner.executeCode.mockResolvedValue({
        success: true,
        output: '{"result": "processed"}',
      });
      mockStorage.updateTestRun.mockResolvedValue({ id: 1, status: 'passed' });
      mockStorage.updateAgentUpload.mockResolvedValue({
        ...createdUpload,
        totalTests: 1,
        passedTests: 1,
        successRate: '100.00',
      });

      const testResponse = await request(app)
        .post('/api/agent-uploads/1/test')
        .set('Authorization', 'Bearer developer-token')
        .send({ testInput: 'test data' });

      expect(testResponse.status).toBe(200);
      expect(testResponse.body.passed).toBe(true);
      expect(mockSandboxRunner.executeCode).toHaveBeenCalled();
    });

    it('should complete full agent upload lifecycle - full-code agent', async () => {
      // Create full-code agent with repo
      const uploadData = {
        name: 'Code Analyzer',
        description: 'Full-code agent for analyzing code',
        uploadType: 'full_code',
        repoUrl: 'https://github.com/dev/code-analyzer',
        entryPoint: 'src/index.ts',
        runtime: 'nodejs',
        capabilities: ['code-analysis'],
        targetCategories: ['development'],
      };

      const createdUpload = createAgentUpload({
        id: 1,
        ...uploadData,
        developerId: 'developer-id',
        status: 'draft',
      });

      mockStorage.createAgentUpload.mockResolvedValue(createdUpload);

      const createResponse = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send(uploadData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.uploadType).toBe('full_code');
      expect(createResponse.body.repoUrl).toBe('https://github.com/dev/code-analyzer');

      // Test the full-code agent using sandbox
      mockStorage.getAgentUpload.mockResolvedValue(createdUpload);
      mockStorage.createTestRun.mockResolvedValue({ id: 1 });
      mockSandboxRunner.testSandbox.mockResolvedValue({
        success: true,
        status: 'completed',
        result: 'All tests passed',
      });
      mockStorage.updateTestRun.mockResolvedValue({ id: 1, status: 'passed' });
      mockStorage.updateAgentUpload.mockResolvedValue({
        ...createdUpload,
        totalTests: 1,
        passedTests: 1,
        successRate: '100.00',
      });

      const testResponse = await request(app)
        .post('/api/agent-uploads/1/test')
        .set('Authorization', 'Bearer developer-token')
        .send({});

      expect(testResponse.status).toBe(200);
      expect(testResponse.body.passed).toBe(true);
      expect(mockSandboxRunner.testSandbox).toHaveBeenCalled();
    });
  });

  describe('Agent Upload Validation', () => {
    it('should reject agent upload without name', async () => {
      const response = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send({ description: 'Test description' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Name and description are required');
    });

    it('should reject agent upload without description', async () => {
      const response = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send({ name: 'Test Agent' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Name and description are required');
    });

    it('should reject invalid upload type', async () => {
      const response = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send({
          name: 'Test Agent',
          description: 'Test',
          uploadType: 'invalid_type',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid upload type');
    });

    it('should reject no-code agent without prompt', async () => {
      const response = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send({
          name: 'Test Agent',
          description: 'Test',
          uploadType: 'no_code',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Prompt is required for no-code agents');
    });

    it('should reject low-code agent without config', async () => {
      const response = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send({
          name: 'Test Agent',
          description: 'Test',
          uploadType: 'low_code',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Configuration is required for low-code agents');
    });

    it('should reject full-code agent without repo or entry point', async () => {
      const response = await request(app)
        .post('/api/agent-uploads')
        .set('Authorization', 'Bearer developer-token')
        .send({
          name: 'Test Agent',
          description: 'Test',
          uploadType: 'full_code',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Repository URL or entry point is required for full-code agents');
    });
  });

  describe('Publishing Requirements', () => {
    it('should reject publishing without any tests', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'draft',
        totalTests: 0,
        passedTests: 0,
        successRate: '0',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/publish')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Agent must have at least one passing test before publishing');
    });

    it('should reject publishing with low success rate', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'draft',
        totalTests: 10,
        passedTests: 4,
        successRate: '40.00',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/publish')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Agent must have at least 50% test success rate before publishing');
    });

    it('should reject publishing already published agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'published',
        totalTests: 5,
        passedTests: 5,
        successRate: '100.00',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/publish')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Agent is already published');
    });
  });

  describe('Access Control', () => {
    it('should prevent unauthorized users from viewing draft uploads', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
        status: 'draft',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .get('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to view this agent upload');
    });

    it('should allow admin to view any draft upload', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
        status: 'draft',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .get('/api/agent-uploads/1')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
    });

    it('should prevent non-owner from testing agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/test')
        .set('Authorization', 'Bearer developer-token')
        .send({ testInput: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to test this agent');
    });

    it('should prevent non-owner from publishing agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
        totalTests: 5,
        passedTests: 5,
        successRate: '100.00',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/publish')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to publish this agent');
    });

    it('should prevent non-owner from updating agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
        status: 'draft',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .patch('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to update this agent upload');
    });

    it('should prevent non-owner from deleting agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
        status: 'draft',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .delete('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to delete this agent');
    });
  });

  describe('Agent Unpublish and Delete', () => {
    it('should allow owner to unpublish agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'published',
        isPublic: true,
      });

      const unpublishedUpload = {
        ...agentUpload,
        status: 'draft',
        isPublic: false,
      };

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);
      mockStorage.updateAgentUpload.mockResolvedValue(unpublishedUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/unpublish')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(200);
      expect(response.body.agentUpload.status).toBe('draft');
      expect(response.body.agentUpload.isPublic).toBe(false);
      expect(response.body.message).toBe('Agent unpublished from marketplace');
    });

    it('should reject unpublishing non-published agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'draft',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .post('/api/agent-uploads/1/unpublish')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Agent is not published');
    });

    it('should allow owner to delete draft agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'draft',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);
      mockStorage.deleteAgentUpload.mockResolvedValue({});

      const response = await request(app)
        .delete('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Agent upload deleted successfully');
      expect(mockStorage.deleteAgentUpload).toHaveBeenCalledWith(1);
    });

    it('should reject deleting published agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'published',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .delete('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot delete published agents. Unpublish first.');
    });
  });

  describe('Update Restrictions', () => {
    it('should allow updating draft agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'draft',
        name: 'Old Name',
      });

      const updatedUpload = {
        ...agentUpload,
        name: 'New Name',
      };

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);
      mockStorage.updateAgentUpload.mockResolvedValue(updatedUpload);

      const response = await request(app)
        .patch('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
    });

    it('should reject updating published agent', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
        status: 'published',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .patch('/api/agent-uploads/1')
        .set('Authorization', 'Bearer developer-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot update published agents. Create a new version instead.');
    });
  });

  describe('Test History', () => {
    it('should return test history for agent upload', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'developer-id',
      });

      const testRuns = [
        { id: 1, status: 'passed', input: 'test1' },
        { id: 2, status: 'failed', input: 'test2' },
        { id: 3, status: 'passed', input: 'test3' },
      ];

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);
      mockStorage.getTestRunsByAgentUpload.mockResolvedValue(testRuns);

      const response = await request(app)
        .get('/api/agent-uploads/1/tests')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0].status).toBe('passed');
    });

    it('should prevent non-owner from viewing test history', async () => {
      const agentUpload = createAgentUpload({
        id: 1,
        developerId: 'other-user-id',
      });

      mockStorage.getAgentUpload.mockResolvedValue(agentUpload);

      const response = await request(app)
        .get('/api/agent-uploads/1/tests')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Not authorized to view test history');
    });
  });

  describe('Developer Agent Uploads', () => {
    it('should return only developer\'s uploads', async () => {
      const uploads = [
        createAgentUpload({ id: 1, developerId: 'developer-id', name: 'Agent 1' }),
        createAgentUpload({ id: 2, developerId: 'developer-id', name: 'Agent 2' }),
      ];

      mockStorage.getAgentUploadsByDeveloper.mockResolvedValue(uploads);

      const response = await request(app)
        .get('/api/agent-uploads/mine')
        .set('Authorization', 'Bearer developer-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(mockStorage.getAgentUploadsByDeveloper).toHaveBeenCalledWith('developer-id');
    });
  });

  describe('Marketplace Listing', () => {
    it('should return published agents with filters', async () => {
      const publishedAgents = [
        createAgentUpload({ id: 1, status: 'published', isPublic: true, targetCategories: ['support'] }),
        createAgentUpload({ id: 2, status: 'published', isPublic: true, targetCategories: ['support'] }),
      ];

      mockStorage.getPublishedAgentUploads.mockResolvedValue(publishedAgents);

      const response = await request(app)
        .get('/api/marketplace/agents')
        .query({ category: 'support', sort: 'rating', limit: '10' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(mockStorage.getPublishedAgentUploads).toHaveBeenCalledWith({
        category: 'support',
        sort: 'rating',
        limit: 10,
      });
    });

    it('should use default limit for marketplace listing', async () => {
      mockStorage.getPublishedAgentUploads.mockResolvedValue([]);

      await request(app).get('/api/marketplace/agents');

      expect(mockStorage.getPublishedAgentUploads).toHaveBeenCalledWith({
        category: undefined,
        sort: undefined,
        limit: 20,
      });
    });
  });
});
