/**
 * Global test setup for Agent-Bounty
 * Runs before all tests to configure mocks and environment
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-32-chars-xx';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.OPENAI_API_KEY = 'sk-test-mock-openai-key';

// Mock console to reduce noise in tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Global test utilities
export const testUtils = {
  /**
   * Wait for a condition to be true
   */
  waitFor: async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  },

  /**
   * Create a mock request object
   */
  mockRequest: (overrides: Partial<any> = {}): any => ({
    user: { claims: { sub: 'test-user-id' } },
    tokenPayload: null,
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  }),

  /**
   * Create a mock response object
   */
  mockResponse: (): any => {
    const res: any = {
      statusCode: 200,
      _json: null,
      _headers: {} as Record<string, string>,
    };
    res.status = vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    });
    res.json = vi.fn((data: any) => {
      res._json = data;
      return res;
    });
    res.setHeader = vi.fn((key: string, value: string) => {
      res._headers[key] = value;
      return res;
    });
    res.send = vi.fn((data: any) => {
      res._json = data;
      return res;
    });
    return res;
  },

  /**
   * Create a mock next function
   */
  mockNext: (): any => vi.fn(),
};

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks();
});

// Make testUtils globally available
declare global {
  var testUtils: typeof testUtils;
}
globalThis.testUtils = testUtils;
