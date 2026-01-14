/**
 * RateLimitMiddleware Tests - Rate limiting middleware for API endpoints
 *
 * Tests the rate limiting functionality including:
 * - Basic rate limiting with custom config
 * - Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 * - 429 responses when rate limit exceeded
 * - Preset rate limiters (apiRateLimit, authRateLimit, credentialRateLimit, aiRateLimit, stripeRateLimit)
 * - User identification (session, JWT, IP, anonymous)
 * - Window reset behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  rateLimit,
  apiRateLimit,
  authRateLimit,
  credentialRateLimit,
  aiRateLimit,
  stripeRateLimit,
} from '../rateLimitMiddleware';

// Generate unique identifiers for each test to avoid global state pollution
let testCounter = 0;
function getUniqueId() {
  return `test-${Date.now()}-${++testCounter}`;
}

describe('RateLimitMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockSetHeader: ReturnType<typeof vi.fn>;
  let uniqueIp: string;
  let uniquePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    mockJson = vi.fn().mockReturnThis();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    mockSetHeader = vi.fn();

    // Use unique identifiers per test to avoid store pollution
    uniqueIp = getUniqueId();
    uniquePath = `/api/${getUniqueId()}`;

    mockReq = {
      ip: uniqueIp,
      path: uniquePath,
      headers: {},
    };
    mockRes = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rateLimit factory function', () => {
    it('should create middleware that allows requests within limit', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 5 });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should set rate limit headers on each request', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 10 });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
      expect(mockSetHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number)
      );
    });

    it('should decrement remaining count on subsequent requests', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 5 });

      // First request
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);

      mockSetHeader.mockClear();

      // Second request
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 3);
    });

    it('should return 429 when rate limit exceeded', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });

      // First two requests should pass
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      mockNext.mockClear();

      // Third request should be rate limited
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many requests, please try again later',
        retryAfter: expect.any(Number),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom rate limit message';
      const middleware = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        message: customMessage,
      });

      // Exhaust rate limit
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        message: customMessage,
        retryAfter: expect.any(Number),
      });
    });

    it('should reset rate limit after window expires', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });

      // Exhaust rate limit
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);

      mockStatus.mockClear();
      mockNext.mockClear();

      // Advance time past the window
      vi.advanceTimersByTime(61000);

      // Request should now succeed
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should show 0 remaining when at or past limit', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 1 });

      // Use up the limit
      middleware(mockReq as Request, mockRes as Response, mockNext);
      mockSetHeader.mockClear();

      // Exceed the limit
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    });
  });

  describe('user identification', () => {
    it('should use session user ID when available', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      const sessionUserId = getUniqueId();
      (mockReq as any).user = { claims: { sub: sessionUserId } };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Create a different request with same session user but different IP
      const otherReq = {
        ...mockReq,
        ip: '10.0.0.1',
        user: { claims: { sub: sessionUserId } },
        path: uniquePath,
      };

      middleware(otherReq as Request, mockRes as Response, mockNext);
      middleware(otherReq as Request, mockRes as Response, mockNext);

      // Should be rate limited because same user
      expect(mockStatus).toHaveBeenCalledWith(429);
    });

    it('should use JWT tokenPayload userId when session not available', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      (mockReq as any).tokenPayload = { userId: getUniqueId() };

      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
    });

    it('should use IP address when no user identification available', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });

      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
    });

    it('should use anonymous when no identification available', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      mockReq.ip = undefined;
      // Use a unique path to isolate this test
      mockReq.path = `/anon/${getUniqueId()}`;

      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
    });

    it('should prefer session user over tokenPayload', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      const sessionUserId = getUniqueId();
      (mockReq as any).user = { claims: { sub: sessionUserId } };
      (mockReq as any).tokenPayload = { userId: getUniqueId() };

      // Make requests that should be counted under session-user
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
    });
  });

  describe('path-based rate limiting', () => {
    it('should track rate limits separately per path', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      const testPath1 = `/path1/${getUniqueId()}`;
      const testPath2 = `/path2/${getUniqueId()}`;

      // Two requests to first path
      mockReq.path = testPath1;
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      mockNext.mockClear();

      // Request to second path should not be rate limited
      mockReq.path = testPath2;
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });
  });

  describe('retryAfter calculation', () => {
    it('should return correct retryAfter in seconds', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 1 });

      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many requests, please try again later',
        retryAfter: 60,
      });
    });

    it('should calculate remaining time correctly mid-window', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 1 });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many requests, please try again later',
        retryAfter: 30,
      });
    });
  });

  describe('preset rate limiters', () => {
    it('apiRateLimit should allow 100 requests per minute', () => {
      // Use unique path for this test
      mockReq.path = `/api/${getUniqueId()}`;

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        apiRateLimit(mockReq as Request, mockRes as Response, mockNext);
      }
      expect(mockNext).toHaveBeenCalledTimes(100);
      expect(mockStatus).not.toHaveBeenCalled();

      mockNext.mockClear();

      // 101st request should be rate limited
      apiRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'API rate limit exceeded. Please wait before making more requests.',
        retryAfter: expect.any(Number),
      });
    });

    it('authRateLimit should allow 10 requests per 15 minutes', () => {
      mockReq.path = `/auth/${getUniqueId()}`;

      for (let i = 0; i < 10; i++) {
        authRateLimit(mockReq as Request, mockRes as Response, mockNext);
      }
      expect(mockNext).toHaveBeenCalledTimes(10);

      mockNext.mockClear();

      authRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: expect.any(Number),
      });
    });

    it('credentialRateLimit should allow 5 requests per minute', () => {
      mockReq.path = `/credentials/${getUniqueId()}`;

      for (let i = 0; i < 5; i++) {
        credentialRateLimit(mockReq as Request, mockRes as Response, mockNext);
      }
      expect(mockNext).toHaveBeenCalledTimes(5);

      mockNext.mockClear();

      credentialRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many credential access attempts. Please wait.',
        retryAfter: expect.any(Number),
      });
    });

    it('aiRateLimit should allow 20 requests per minute', () => {
      mockReq.path = `/ai/${getUniqueId()}`;

      for (let i = 0; i < 20; i++) {
        aiRateLimit(mockReq as Request, mockRes as Response, mockNext);
      }
      expect(mockNext).toHaveBeenCalledTimes(20);

      mockNext.mockClear();

      aiRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'AI execution rate limit exceeded. Please wait.',
        retryAfter: expect.any(Number),
      });
    });

    it('stripeRateLimit should allow 10 requests per minute', () => {
      mockReq.path = `/stripe/${getUniqueId()}`;

      for (let i = 0; i < 10; i++) {
        stripeRateLimit(mockReq as Request, mockRes as Response, mockNext);
      }
      expect(mockNext).toHaveBeenCalledTimes(10);

      mockNext.mockClear();

      stripeRateLimit(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many payment requests. Please wait.',
        retryAfter: expect.any(Number),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent requests correctly', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 3 });

      // Simulate multiple concurrent requests
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    });

    it('should handle very short window correctly', () => {
      const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 });

      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockStatus).toHaveBeenCalledWith(429);

      mockStatus.mockClear();
      mockNext.mockClear();

      // Advance past window
      vi.advanceTimersByTime(1001);

      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should handle large maxRequests value', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 1000 });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1000);
      expect(mockSetHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 999);
    });

    it('should handle requests with undefined path', () => {
      const middleware = rateLimit({ windowMs: 60000, maxRequests: 2 });
      mockReq.path = undefined as any;
      // Use unique IP to isolate this test
      mockReq.ip = getUniqueId();

      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(429);
    });
  });
});
