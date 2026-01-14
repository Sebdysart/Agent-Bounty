/**
 * Test Mock Factories
 * Generate realistic test data for User, Bounty, Agent, Submission entities
 */

import { randomUUID } from 'crypto';

// ============================================
// USER FACTORIES
// ============================================

let userCounter = 0;

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  userCounter++;
  return {
    id: overrides.id ?? `user_${userCounter}_${randomUUID().slice(0, 8)}`,
    role: overrides.role ?? 'business',
    isAdmin: overrides.isAdmin ?? false,
    companyName: overrides.companyName ?? `Test Company ${userCounter}`,
    bio: overrides.bio ?? 'Test user bio',
    totalSpent: overrides.totalSpent ?? '0',
    totalEarned: overrides.totalEarned ?? '0',
    stripeCustomerId: overrides.stripeCustomerId ?? null,
    stripeConnectAccountId: overrides.stripeConnectAccountId ?? null,
    subscriptionTier: overrides.subscriptionTier ?? 'free',
    stripeSubscriptionId: overrides.stripeSubscriptionId ?? null,
    subscriptionExpiresAt: overrides.subscriptionExpiresAt ?? null,
    monthlyBountyLimit: overrides.monthlyBountyLimit ?? 3,
    bountiesPostedThisMonth: overrides.bountiesPostedThisMonth ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export interface MockUser {
  id: string;
  role: 'business' | 'developer' | 'admin' | 'moderator' | 'viewer';
  isAdmin: boolean;
  companyName: string | null;
  bio: string | null;
  totalSpent: string;
  totalEarned: string;
  stripeCustomerId: string | null;
  stripeConnectAccountId: string | null;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  stripeSubscriptionId: string | null;
  subscriptionExpiresAt: Date | null;
  monthlyBountyLimit: number;
  bountiesPostedThisMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// BOUNTY FACTORIES
// ============================================

let bountyCounter = 0;

export function createMockBounty(overrides: Partial<MockBounty> = {}): MockBounty {
  bountyCounter++;
  const posterId = overrides.posterId ?? `user_poster_${bountyCounter}`;
  return {
    id: overrides.id ?? bountyCounter,
    title: overrides.title ?? `Test Bounty ${bountyCounter}`,
    description: overrides.description ?? 'Test bounty description with detailed requirements.',
    category: overrides.category ?? 'development',
    reward: overrides.reward ?? '500.00',
    successMetrics: overrides.successMetrics ?? 'All tests pass, code coverage > 80%',
    verificationCriteria: overrides.verificationCriteria ?? 'Automated test verification',
    deadline: overrides.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    status: overrides.status ?? 'open',
    posterId,
    winnerId: overrides.winnerId ?? null,
    paymentStatus: overrides.paymentStatus ?? 'pending',
    stripePaymentIntentId: overrides.stripePaymentIntentId ?? null,
    stripeCheckoutSessionId: overrides.stripeCheckoutSessionId ?? null,
    orchestrationMode: overrides.orchestrationMode ?? 'single',
    maxAgents: overrides.maxAgents ?? 1,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function createFundedBounty(overrides: Partial<MockBounty> = {}): MockBounty {
  return createMockBounty({
    status: 'open',
    paymentStatus: 'funded',
    stripePaymentIntentId: `pi_test_${randomUUID().slice(0, 8)}`,
    stripeCheckoutSessionId: `cs_test_${randomUUID().slice(0, 8)}`,
    ...overrides,
  });
}

export function createCompletedBounty(overrides: Partial<MockBounty> = {}): MockBounty {
  return createMockBounty({
    status: 'completed',
    paymentStatus: 'released',
    stripePaymentIntentId: `pi_test_${randomUUID().slice(0, 8)}`,
    winnerId: overrides.winnerId ?? 1,
    ...overrides,
  });
}

export interface MockBounty {
  id: number;
  title: string;
  description: string;
  category: string;
  reward: string;
  successMetrics: string;
  verificationCriteria: string;
  deadline: Date;
  status: 'open' | 'in_progress' | 'under_review' | 'completed' | 'failed' | 'cancelled';
  posterId: string;
  winnerId: number | null;
  paymentStatus: 'pending' | 'funded' | 'released' | 'refunded';
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  orchestrationMode: 'single' | 'parallel' | 'sequential' | 'competitive';
  maxAgents: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// AGENT FACTORIES
// ============================================

let agentCounter = 0;

export function createMockAgent(overrides: Partial<MockAgent> = {}): MockAgent {
  agentCounter++;
  return {
    id: overrides.id ?? agentCounter,
    name: overrides.name ?? `Test Agent ${agentCounter}`,
    description: overrides.description ?? 'A test AI agent for automated tasks.',
    capabilities: overrides.capabilities ?? ['data_analysis', 'code_generation', 'testing'],
    developerId: overrides.developerId ?? `user_dev_${agentCounter}`,
    avatarColor: overrides.avatarColor ?? '#3B82F6',
    completionRate: overrides.completionRate ?? '85.00',
    totalEarnings: overrides.totalEarnings ?? '2500.00',
    totalBounties: overrides.totalBounties ?? 10,
    avgRating: overrides.avgRating ?? '4.50',
    isVerified: overrides.isVerified ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function createTopAgent(overrides: Partial<MockAgent> = {}): MockAgent {
  return createMockAgent({
    completionRate: '98.00',
    totalEarnings: '50000.00',
    totalBounties: 100,
    avgRating: '4.95',
    isVerified: true,
    ...overrides,
  });
}

export interface MockAgent {
  id: number;
  name: string;
  description: string;
  capabilities: string[];
  developerId: string;
  avatarColor: string;
  completionRate: string;
  totalEarnings: string;
  totalBounties: number;
  avgRating: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SUBMISSION FACTORIES
// ============================================

let submissionCounter = 0;

export function createMockSubmission(overrides: Partial<MockSubmission> = {}): MockSubmission {
  submissionCounter++;
  return {
    id: overrides.id ?? submissionCounter,
    bountyId: overrides.bountyId ?? 1,
    agentId: overrides.agentId ?? 1,
    status: overrides.status ?? 'pending',
    progress: overrides.progress ?? 0,
    output: overrides.output ?? null,
    submittedAt: overrides.submittedAt ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function createCompletedSubmission(overrides: Partial<MockSubmission> = {}): MockSubmission {
  return createMockSubmission({
    status: 'approved',
    progress: 100,
    output: JSON.stringify({ result: 'Task completed successfully', metrics: { accuracy: 0.95 } }),
    submittedAt: new Date(),
    ...overrides,
  });
}

export interface MockSubmission {
  id: number;
  bountyId: number;
  agentId: number;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  progress: number;
  output: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CREDENTIAL FACTORIES
// ============================================

export function createMockCredential(overrides: any = {}) {
  return {
    credentials: overrides.credentials ?? { apiKey: 'test-api-key-123', accessToken: 'test-token' },
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    userId: overrides.userId ?? 'user_test_123',
    agentId: overrides.agentId ?? 1,
    requirementId: overrides.requirementId ?? 1,
    encryptedAt: overrides.encryptedAt ?? new Date(),
  };
}

// ============================================
// STRIPE EVENT FACTORIES
// ============================================

export function createMockStripeCheckoutSession(overrides: any = {}) {
  return {
    id: overrides.id ?? `cs_test_${randomUUID().slice(0, 8)}`,
    payment_intent: overrides.payment_intent ?? `pi_test_${randomUUID().slice(0, 8)}`,
    customer: overrides.customer ?? `cus_test_${randomUUID().slice(0, 8)}`,
    metadata: overrides.metadata ?? { bountyId: '1' },
    status: overrides.status ?? 'complete',
    mode: overrides.mode ?? 'payment',
    ...overrides,
  };
}

export function createMockStripePaymentIntent(overrides: any = {}) {
  return {
    id: overrides.id ?? `pi_test_${randomUUID().slice(0, 8)}`,
    amount: overrides.amount ?? 50000, // $500.00 in cents
    currency: overrides.currency ?? 'usd',
    status: overrides.status ?? 'requires_capture',
    customer: overrides.customer ?? `cus_test_${randomUUID().slice(0, 8)}`,
    metadata: overrides.metadata ?? { bountyId: '1', type: 'bounty_escrow' },
    capture_method: overrides.capture_method ?? 'manual',
    ...overrides,
  };
}

export function createMockStripeCharge(overrides: any = {}) {
  return {
    id: overrides.id ?? `ch_test_${randomUUID().slice(0, 8)}`,
    payment_intent: overrides.payment_intent ?? `pi_test_${randomUUID().slice(0, 8)}`,
    amount: overrides.amount ?? 50000,
    amount_captured: overrides.amount_captured ?? 50000,
    status: overrides.status ?? 'succeeded',
    ...overrides,
  };
}

// ============================================
// RESET COUNTERS (for test isolation)
// ============================================

export function resetFactoryCounters() {
  userCounter = 0;
  bountyCounter = 0;
  agentCounter = 0;
  submissionCounter = 0;
}
