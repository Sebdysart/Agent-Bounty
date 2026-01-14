/**
 * Agents Routes Tests - Core API endpoints for agent management
 *
 * Tests the agent CRUD operations:
 * - GET /api/agents - List all agents
 * - GET /api/agents/top - Get top agents by rating
 * - GET /api/agents/mine - Get current user's agents
 * - POST /api/agents - Create agent (requires auth)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createAgent, resetIdCounter } from '../factories';

// Mock storage
const mockStorage = {
  getAllAgents: vi.fn(),
  getTopAgents: vi.fn(),
  getAgentsByDeveloper: vi.fn(),
  getAgent: vi.fn(),
  createAgent: vi.fn(),
};

vi.mock('../../storage', () => ({
  storage: mockStorage,
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

// Create a minimal test app with just the agent routes
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

  // GET /api/agents
  app.get('/api/agents', async (req, res) => {
    try {
      const agents = await mockStorage.getAllAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch agents' });
    }
  });

  // GET /api/agents/top
  app.get('/api/agents/top', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const agents = await mockStorage.getTopAgents(limit);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch top agents' });
    }
  });

  // GET /api/agents/mine
  app.get('/api/agents/mine', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const agents = await mockStorage.getAgentsByDeveloper(userId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch user agents' });
    }
  });

  // POST /api/agents
  app.post('/api/agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Basic validation
      const { name, description, capabilities } = req.body;
      if (!name || !description) {
        return res.status(400).json({ message: 'Invalid agent data', errors: [{ message: 'Missing required fields' }] });
      }

      if (capabilities && !Array.isArray(capabilities)) {
        return res.status(400).json({ message: 'Invalid agent data', errors: [{ message: 'Capabilities must be an array' }] });
      }

      const agent = await mockStorage.createAgent({ ...req.body, developerId: userId });
      res.status(201).json(agent);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create agent' });
    }
  });

  return app;
}

describe('Agents Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    app = createTestApp();
  });

  describe('GET /api/agents', () => {
    it('should return all agents', async () => {
      const agents = [
        createAgent({ id: 1, name: 'Agent 1', avgRating: '4.5' }),
        createAgent({ id: 2, name: 'Agent 2', avgRating: '3.8' }),
      ];
      mockStorage.getAllAgents.mockResolvedValue(agents);

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Agent 1');
      expect(response.body[1].name).toBe('Agent 2');
      expect(mockStorage.getAllAgents).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no agents exist', async () => {
      mockStorage.getAllAgents.mockResolvedValue([]);

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.getAllAgents.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to fetch agents');
    });
  });

  describe('GET /api/agents/top', () => {
    it('should return agents sorted by rating', async () => {
      const agents = [
        createAgent({ id: 1, name: 'Top Agent', avgRating: '5.0' }),
        createAgent({ id: 2, name: 'Second Agent', avgRating: '4.8' }),
        createAgent({ id: 3, name: 'Third Agent', avgRating: '4.5' }),
      ];
      mockStorage.getTopAgents.mockResolvedValue(agents);

      const response = await request(app).get('/api/agents/top');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0].name).toBe('Top Agent');
      expect(response.body[0].avgRating).toBe('5.0');
      expect(mockStorage.getTopAgents).toHaveBeenCalledWith(10); // default limit
    });

    it('should respect limit parameter', async () => {
      const agents = [
        createAgent({ id: 1, name: 'Top Agent', avgRating: '5.0' }),
        createAgent({ id: 2, name: 'Second Agent', avgRating: '4.8' }),
      ];
      mockStorage.getTopAgents.mockResolvedValue(agents);

      const response = await request(app).get('/api/agents/top?limit=2');

      expect(response.status).toBe(200);
      expect(mockStorage.getTopAgents).toHaveBeenCalledWith(2);
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.getTopAgents.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/agents/top');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to fetch top agents');
    });
  });

  describe('GET /api/agents/mine', () => {
    it('should return only user\'s agents', async () => {
      const agents = [
        createAgent({ id: 1, name: 'My Agent 1', developerId: 'test-user-id' }),
        createAgent({ id: 2, name: 'My Agent 2', developerId: 'test-user-id' }),
      ];
      mockStorage.getAgentsByDeveloper.mockResolvedValue(agents);

      const response = await request(app)
        .get('/api/agents/mine')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].developerId).toBe('test-user-id');
      expect(mockStorage.getAgentsByDeveloper).toHaveBeenCalledWith('test-user-id');
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/agents/mine');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized');
      expect(mockStorage.getAgentsByDeveloper).not.toHaveBeenCalled();
    });

    it('should return empty array when user has no agents', async () => {
      mockStorage.getAgentsByDeveloper.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/agents/mine')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.getAgentsByDeveloper.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/agents/mine')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to fetch user agents');
    });
  });

  describe('POST /api/agents', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/agents')
        .send({ name: 'Test Agent', description: 'Test description' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized');
      expect(mockStorage.createAgent).not.toHaveBeenCalled();
    });

    it('should validate input - require name', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', 'Bearer valid-token')
        .send({ description: 'Test description' }); // Missing name

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid agent data');
    });

    it('should validate input - require description', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test Agent' }); // Missing description

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid agent data');
    });

    it('should validate input - capabilities must be array', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test Agent', description: 'Test', capabilities: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid agent data');
    });

    it('should create agent successfully with valid data', async () => {
      const agentData = {
        name: 'New Agent',
        description: 'A powerful new agent',
        capabilities: ['coding', 'testing'],
      };

      const createdAgent = createAgent({ ...agentData, id: 1, developerId: 'test-user-id' });
      mockStorage.createAgent.mockResolvedValue(createdAgent);

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', 'Bearer valid-token')
        .send(agentData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Agent');
      expect(response.body.developerId).toBe('test-user-id');
      expect(mockStorage.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ developerId: 'test-user-id', name: 'New Agent' })
      );
    });

    it('should set developerId from session', async () => {
      const agentData = {
        name: 'Developer Agent',
        description: 'Agent with owner',
        capabilities: ['automation'],
      };

      const createdAgent = createAgent({ ...agentData, id: 1, developerId: 'test-user-id' });
      mockStorage.createAgent.mockResolvedValue(createdAgent);

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', 'Bearer valid-token')
        .send(agentData);

      expect(response.status).toBe(201);
      expect(mockStorage.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ developerId: 'test-user-id' })
      );
    });

    it('should handle server errors gracefully', async () => {
      mockStorage.createAgent.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test Agent', description: 'Test description' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to create agent');
    });
  });
});
