/**
 * Vitest Test Setup
 * Mocks for database, Stripe, OpenAI, and other external services
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ============================================
// ENVIRONMENT SETUP
// ============================================

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-32-chars-xx';
process.env.CREDENTIAL_ENCRYPTION_SALT = 'test-salt';

// ============================================
// DATABASE MOCK
// ============================================

export const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue({ rows: [] }),
};

vi.mock('../db', () => ({
  db: mockDb,
}));

// ============================================
// STRIPE MOCK
// ============================================

export const mockStripe = {
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@example.com' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@example.com' }),
  },
  paymentIntents: {
    create: vi.fn().mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret',
      status: 'requires_capture',
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
        payment_intent: 'pi_test123',
      }),
    },
  },
  transfers: {
    create: vi.fn().mockResolvedValue({ id: 'tr_test123', amount: 8500 }),
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
  subscriptions: {
    cancel: vi.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' }),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

vi.mock('../stripeClient', () => ({
  getUncachableStripeClient: vi.fn().mockResolvedValue(mockStripe),
  getStripeSync: vi.fn().mockResolvedValue({
    processWebhook: vi.fn(),
    findOrCreateManagedWebhook: vi.fn(),
    syncBackfill: vi.fn(),
  }),
  getStripePublishableKey: vi.fn().mockReturnValue('pk_test_123'),
}));

// ============================================
// OPENAI MOCK
// ============================================

export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'chatcmpl-test123',
        choices: [
          {
            message: { role: 'assistant', content: 'Test AI response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
}));

// ============================================
// STORAGE MOCK
// ============================================

export const mockStorage = {
  // Bounties
  getAllBounties: vi.fn().mockResolvedValue([]),
  getBounty: vi.fn().mockResolvedValue(null),
  createBounty: vi.fn().mockResolvedValue({ id: 1 }),
  updateBountyStatus: vi.fn().mockResolvedValue({ id: 1 }),
  updateBountyPaymentIntent: vi.fn().mockResolvedValue(undefined),
  updateBountyPaymentStatus: vi.fn().mockResolvedValue(undefined),
  getBountyByPaymentIntent: vi.fn().mockResolvedValue(null),
  addTimelineEvent: vi.fn().mockResolvedValue({ id: 1 }),
  getBountyTimeline: vi.fn().mockResolvedValue([]),
  
  // Agents
  getAllAgents: vi.fn().mockResolvedValue([]),
  getAgent: vi.fn().mockResolvedValue(null),
  createAgent: vi.fn().mockResolvedValue({ id: 1 }),
  getTopAgents: vi.fn().mockResolvedValue([]),
  getAgentsByDeveloper: vi.fn().mockResolvedValue([]),
  
  // Submissions
  getSubmissionsByBounty: vi.fn().mockResolvedValue([]),
  getSubmission: vi.fn().mockResolvedValue(null),
  createSubmission: vi.fn().mockResolvedValue({ id: 1 }),
  updateSubmissionStatus: vi.fn().mockResolvedValue({ id: 1 }),
  
  // Users
  getOrCreateUserProfile: vi.fn().mockResolvedValue({ id: 'user123' }),
  getUserProfile: vi.fn().mockResolvedValue(null),
  getUserProfileByStripeCustomerId: vi.fn().mockResolvedValue(null),
  updateUserSubscription: vi.fn().mockResolvedValue(undefined),
  
  // Stats
  getStats: vi.fn().mockResolvedValue({
    totalBounties: 0,
    totalAgents: 0,
    totalReward: '0',
    completedBounties: 0,
  }),
  getRecentActivity: vi.fn().mockResolvedValue([]),
};

vi.mock('../storage', () => ({
  storage: mockStorage,
}));

// ============================================
// TEST LIFECYCLE
// ============================================

beforeAll(() => {
  console.log('🧪 Test suite starting...');
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
  console.log('🧪 Test suite complete.');
});

// ============================================
// TEST UTILITIES
// ============================================

export function createMockRequest(overrides: any = {}) {
  return {
    user: { claims: { sub: 'test-user-123' } },
    tokenPayload: null,
    authUserId: 'test-user-123',
    authRoles: ['business'],
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

export function createMockResponse() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

export function createMockNext() {
  return vi.fn();
}
