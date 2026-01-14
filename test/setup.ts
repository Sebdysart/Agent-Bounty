/**
 * Test Setup - Mocks and global configuration for Vitest
 * 
 * This file runs before all tests and sets up:
 * - Database mocks
 * - External service mocks (Stripe, OpenAI)
 * - Environment variables
 * - Global test utilities
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
process.env.OPENAI_API_KEY = 'sk-test-fake-openai-key';

// ============================================
// DATABASE MOCKS
// ============================================

export const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue({ rows: [] }),
};

vi.mock('../server/db', () => ({
  db: mockDb,
}));

// ============================================
// STRIPE MOCKS
// ============================================

export const mockStripe = {
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@test.com' }),
  },
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ 
      id: 'pi_test123', 
      client_secret: 'pi_test123_secret',
      status: 'requires_capture'
    }),
    capture: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'requires_capture' }),
  },
  refunds: {
    create: vi.fn().mockResolvedValue({ id: 're_test123', status: 'succeeded' }),
  },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({ 
        id: 'cs_test123', 
        url: 'https://checkout.stripe.com/test',
        payment_intent: 'pi_test123'
      }),
    },
  },
  subscriptions: {
    cancel: vi.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' }),
  },
  products: {
    create: vi.fn().mockResolvedValue({ id: 'prod_test123' }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    retrieve: vi.fn().mockResolvedValue({ id: 'prod_test123', metadata: { tier: 'pro' } }),
  },
  prices: {
    create: vi.fn().mockResolvedValue({ id: 'price_test123' }),
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
  transfers: {
    create: vi.fn().mockResolvedValue({ id: 'tr_test123' }),
  },
};

vi.mock('../server/stripeClient', () => ({
  getUncachableStripeClient: vi.fn().mockResolvedValue(mockStripe),
  getStripePublishableKey: vi.fn().mockReturnValue('pk_test_fake'),
  getStripeSync: vi.fn().mockResolvedValue({
    processWebhook: vi.fn(),
    findOrCreateManagedWebhook: vi.fn(),
    syncBackfill: vi.fn(),
  }),
}));

// ============================================
// OPENAI MOCKS
// ============================================

export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'chatcmpl-test123',
        choices: [{ message: { content: 'Test AI response' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
}));

// ============================================
// STORAGE MOCKS
// ============================================

export const mockStorage = {
  // Bounties
  getAllBounties: vi.fn().mockResolvedValue([]),
  getBounty: vi.fn().mockResolvedValue(null),
  createBounty: vi.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
  updateBountyStatus: vi.fn().mockResolvedValue({ id: 1, status: 'open' }),
  updateBountyPaymentStatus: vi.fn().mockResolvedValue(undefined),
  updateBountyPaymentIntent: vi.fn().mockResolvedValue(undefined),
  getBountyByPaymentIntent: vi.fn().mockResolvedValue(null),
  getBountyTimeline: vi.fn().mockResolvedValue([]),
  addTimelineEvent: vi.fn().mockResolvedValue({ id: 1 }),
  
  // Agents
  getAllAgents: vi.fn().mockResolvedValue([]),
  getAgent: vi.fn().mockResolvedValue(null),
  createAgent: vi.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
  getAgentsByDeveloper: vi.fn().mockResolvedValue([]),
  getTopAgents: vi.fn().mockResolvedValue([]),
  
  // Submissions
  getSubmissionsByBounty: vi.fn().mockResolvedValue([]),
  getSubmission: vi.fn().mockResolvedValue(null),
  createSubmission: vi.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
  updateSubmissionStatus: vi.fn().mockResolvedValue({ id: 1 }),
  
  // Users
  getUserProfile: vi.fn().mockResolvedValue(null),
  getUserProfileByStripeCustomerId: vi.fn().mockResolvedValue(null),
  createUserProfile: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'user_1', ...data })),
  updateUserProfile: vi.fn().mockResolvedValue({ id: 'user_1' }),
  updateUserStripeCustomerId: vi.fn().mockResolvedValue(undefined),
  updateUserSubscription: vi.fn().mockResolvedValue(undefined),
  
  // Stats
  getStats: vi.fn().mockResolvedValue({ totalBounties: 0, totalAgents: 0, totalPaid: 0 }),
  getRecentActivity: vi.fn().mockResolvedValue([]),
};

vi.mock('../server/storage', () => ({
  storage: mockStorage,
}));

// ============================================
// TEST UTILITIES
// ============================================

/**
 * Create a mock Express request
 */
export function createMockRequest(overrides: any = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    tokenPayload: null,
    ip: '127.0.0.1',
    ...overrides,
  };
}

/**
 * Create a mock Express response
 */
export function createMockResponse() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Create a mock authenticated user
 */
export function createMockUser(overrides: any = {}) {
  return {
    claims: {
      sub: 'user_test123',
      email: 'test@example.com',
      ...overrides.claims,
    },
    ...overrides,
  };
}

/**
 * Create a mock JWT payload
 */
export function createMockTokenPayload(overrides: any = {}) {
  return {
    userId: 'user_test123',
    roles: ['business'],
    permissions: ['bounty:create', 'bounty:read'],
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'jwt_test123',
    ...overrides,
  };
}

// ============================================
// TEST FACTORIES
// ============================================

export const factories = {
  bounty: (overrides: any = {}) => ({
    id: 1,
    title: 'Test Bounty',
    description: 'Test bounty description',
    category: 'development',
    reward: '100.00',
    successMetrics: 'Complete the task',
    verificationCriteria: 'Code works correctly',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'open',
    posterId: 'user_test123',
    winnerId: null,
    paymentStatus: 'pending',
    stripePaymentIntentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  agent: (overrides: any = {}) => ({
    id: 1,
    name: 'Test Agent',
    description: 'Test agent description',
    capabilities: ['coding', 'analysis'],
    developerId: 'user_test123',
    avatarColor: '#3B82F6',
    completionRate: '0',
    totalEarnings: '0',
    totalBounties: 0,
    avgRating: '0',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  submission: (overrides: any = {}) => ({
    id: 1,
    bountyId: 1,
    agentId: 1,
    status: 'pending',
    progress: 0,
    output: null,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  userProfile: (overrides: any = {}) => ({
    id: 'user_test123',
    role: 'business',
    isAdmin: false,
    companyName: 'Test Company',
    bio: 'Test bio',
    totalSpent: '0',
    totalEarned: '0',
    stripeCustomerId: null,
    subscriptionTier: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

// ============================================
// LIFECYCLE HOOKS
// ============================================

beforeAll(() => {
  console.log('🧪 Test suite starting...');
});

afterEach(() => {
  // Clear all mock calls between tests
  vi.clearAllMocks();
});

afterAll(() => {
  console.log('✅ Test suite complete');
});
