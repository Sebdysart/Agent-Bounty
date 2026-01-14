/**
 * Test data factories for Agent-Bounty entities
 * Use these to create consistent test data
 */

let idCounter = 1;

const generateId = () => idCounter++;

export const resetIdCounter = () => {
  idCounter = 1;
};

/**
 * Create a test user
 */
export const createUser = (overrides: Partial<any> = {}): any => ({
  id: `user-${generateId()}`,
  email: `test${idCounter}@example.com`,
  name: `Test User ${idCounter}`,
  role: 'business',
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Create a test user profile
 */
export const createUserProfile = (overrides: Partial<any> = {}): any => ({
  id: `user-${generateId()}`,
  role: 'business',
  isAdmin: false,
  companyName: 'Test Company',
  bio: 'Test bio',
  totalSpent: '0',
  totalEarned: '0',
  stripeCustomerId: null,
  stripeConnectAccountId: null,
  subscriptionTier: 'free',
  stripeSubscriptionId: null,
  subscriptionExpiresAt: null,
  monthlyBountyLimit: 3,
  bountiesPostedThisMonth: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Create a test bounty
 */
export const createBounty = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    title: `Test Bounty ${id}`,
    description: 'This is a test bounty for testing purposes.',
    category: 'development',
    reward: '100.00',
    successMetrics: 'Complete the task successfully',
    verificationCriteria: 'All tests pass',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    status: 'open',
    posterId: 'test-user-id',
    winnerId: null,
    paymentStatus: 'pending',
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    orchestrationMode: 'single',
    maxAgents: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a test agent
 */
export const createAgent = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    name: `Test Agent ${id}`,
    description: 'This is a test agent for testing purposes.',
    capabilities: ['testing', 'automation'],
    developerId: 'test-developer-id',
    avatarColor: '#3B82F6',
    completionRate: '0',
    totalEarnings: '0',
    totalBounties: 0,
    avgRating: '0',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a test submission
 */
export const createSubmission = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    bountyId: 1,
    agentId: 1,
    status: 'pending',
    progress: 0,
    output: null,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a test review
 */
export const createReview = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    submissionId: 1,
    reviewerId: 'test-reviewer-id',
    rating: 5,
    comment: 'Great work!',
    createdAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a test agent upload
 */
export const createAgentUpload = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    name: `Test Upload ${id}`,
    description: 'Test agent upload',
    uploadType: 'no_code',
    status: 'draft',
    developerId: 'test-developer-id',
    prompt: 'Test prompt',
    configJson: null,
    manifestJson: null,
    repoUrl: null,
    entryPoint: null,
    runtime: 'nodejs',
    capabilities: ['testing'],
    targetCategories: ['development'],
    avatarUrl: null,
    avatarColor: '#3B82F6',
    version: '1.0.0',
    isPublic: false,
    price: '0',
    successRate: '0',
    totalTests: 0,
    passedTests: 0,
    totalBountiesCompleted: 0,
    avgResponseTime: '0',
    rating: '0',
    reviewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a test dispute
 */
export const createDispute = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    bountyId: 1,
    submissionId: 1,
    initiatorId: 'test-user-id',
    respondentId: 'test-developer-id',
    category: 'quality',
    title: 'Test Dispute',
    description: 'This is a test dispute',
    status: 'open',
    priority: 'medium',
    resolution: null,
    resolutionNotes: null,
    assignedTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Create a test execution run
 */
export const createExecutionRun = (overrides: Partial<any> = {}): any => {
  const id = generateId();
  return {
    id,
    agentId: 1,
    bountyId: null,
    submissionId: null,
    sessionId: null,
    input: 'Test input',
    output: null,
    model: 'gpt-4o',
    systemPrompt: null,
    status: 'queued',
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: '0',
    executionTimeMs: null,
    retryCount: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
};

/**
 * Create test stored credentials
 */
export const createStoredCredentials = (overrides: Partial<any> = {}): any => ({
  credentials: { apiKey: 'test-api-key', secretToken: 'test-secret' },
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  userId: 'test-user-id',
  agentId: 1,
  requirementId: 1,
  encryptedAt: new Date(),
  ...overrides,
});

// Export all factories
export const factories = {
  createUser,
  createUserProfile,
  createBounty,
  createAgent,
  createSubmission,
  createReview,
  createAgentUpload,
  createDispute,
  createExecutionRun,
  createStoredCredentials,
  resetIdCounter,
};

export default factories;
