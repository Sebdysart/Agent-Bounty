/**
 * Sensitive Routes Rate Limiting Tests
 *
 * Verifies that all sensitive routes have appropriate rate limiting middleware applied.
 * This is a security-critical test to prevent abuse of sensitive endpoints.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Sensitive Routes Rate Limiting Verification', () => {
  const routesFilePath = path.join(__dirname, '../../routes.ts');
  let routesContent: string;

  // Read the routes file once for all tests
  beforeAll(() => {
    routesContent = fs.readFileSync(routesFilePath, 'utf-8');
  });

  /**
   * Helper function to check if a route has a specific rate limiter
   */
  function routeHasRateLimiter(routePattern: string, limiter: string): boolean {
    // Create a regex that matches the route definition with the rate limiter
    const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`app\\.(post|get|patch|put|delete)\\s*\\([^)]*${escapedPattern}[^)]*,\\s*[^,]*${limiter}`);
    return regex.test(routesContent);
  }

  describe('Authentication Routes - authRateLimit', () => {
    const authRoutes = [
      '/api/auth/token',
      '/api/auth/refresh',
      '/api/auth/revoke',
      '/api/security/settings',
      '/api/security/2fa/setup',
      '/api/security/2fa/enable',
      '/api/security/2fa/disable',
      '/api/security/2fa/verify',
    ];

    authRoutes.forEach(route => {
      it(`should have authRateLimit on ${route}`, () => {
        expect(routeHasRateLimiter(route, 'authRateLimit')).toBe(true);
      });
    });
  });

  describe('Credential Routes - credentialRateLimit', () => {
    const credentialRoutes = [
      '/api/credentials/:requirementId/consent',
      '/api/credentials/:consentId/access',
      '/api/credentials/:consentId/revoke',
      '/api/bounties/:id/credentials',
    ];

    credentialRoutes.forEach(route => {
      it(`should have credentialRateLimit on ${route}`, () => {
        expect(routeHasRateLimiter(route, 'credentialRateLimit')).toBe(true);
      });
    });
  });

  describe('Payment Routes - stripeRateLimit', () => {
    const paymentRoutes = [
      '/api/bounties/:id/fund',
      '/api/bounties/:id/release-payment',
      '/api/bounties/:id/refund',
      '/api/subscription/checkout',
      '/api/subscription/cancel',
    ];

    paymentRoutes.forEach(route => {
      it(`should have stripeRateLimit on ${route}`, () => {
        expect(routeHasRateLimiter(route, 'stripeRateLimit')).toBe(true);
      });
    });
  });

  describe('AI Execution Routes - aiRateLimit', () => {
    const aiRoutes = [
      '/api/ai/generate-bounty',
      '/api/ai/verify-output',
      '/api/ai/generate-agent',
      '/api/executions",', // Note: POST with aiRateLimit
      '/api/executions/:id/retry',
      '/api/sandbox/test',
      '/api/llm/chat',
    ];

    it('should have aiRateLimit on POST /api/executions', () => {
      // Special check for /api/executions since it doesn't have params
      // The route looks like: app.post("/api/executions", isAuthenticated, aiRateLimit, ...
      const regex = /app\.post\s*\(\s*["']\/api\/executions["']\s*,[^)]*aiRateLimit/;
      expect(regex.test(routesContent)).toBe(true);
    });

    it('should have aiRateLimit on /api/ai/generate-bounty', () => {
      expect(routeHasRateLimiter('/api/ai/generate-bounty', 'aiRateLimit')).toBe(true);
    });

    it('should have aiRateLimit on /api/ai/verify-output', () => {
      expect(routeHasRateLimiter('/api/ai/verify-output', 'aiRateLimit')).toBe(true);
    });

    it('should have aiRateLimit on /api/ai/generate-agent', () => {
      expect(routeHasRateLimiter('/api/ai/generate-agent', 'aiRateLimit')).toBe(true);
    });

    it('should have aiRateLimit on /api/executions/:id/retry', () => {
      expect(routeHasRateLimiter('/api/executions/:id/retry', 'aiRateLimit')).toBe(true);
    });

    it('should have aiRateLimit on /api/sandbox/test', () => {
      expect(routeHasRateLimiter('/api/sandbox/test', 'aiRateLimit')).toBe(true);
    });

    it('should have aiRateLimit on /api/llm/chat', () => {
      expect(routeHasRateLimiter('/api/llm/chat', 'aiRateLimit')).toBe(true);
    });
  });

  describe('Privacy Routes - apiRateLimit', () => {
    const privacyRoutes = [
      '/api/privacy/export',
      '/api/privacy/delete',
      '/api/privacy/delete/confirm',
    ];

    privacyRoutes.forEach(route => {
      it(`should have apiRateLimit on ${route}`, () => {
        expect(routeHasRateLimiter(route, 'apiRateLimit')).toBe(true);
      });
    });
  });

  describe('Rate Limiting Coverage Summary', () => {
    it('should import all rate limiters from rateLimitMiddleware', () => {
      const importRegex = /import\s*\{[^}]*apiRateLimit[^}]*authRateLimit[^}]*credentialRateLimit[^}]*aiRateLimit[^}]*stripeRateLimit[^}]*\}\s*from\s*["']\.\/rateLimitMiddleware["']/;
      expect(importRegex.test(routesContent)).toBe(true);
    });

    it('should have rate limiting on sensitive route categories', () => {
      // Count the number of rate-limited routes by category
      const authRateLimitCount = (routesContent.match(/authRateLimit/g) || []).length;
      const credentialRateLimitCount = (routesContent.match(/credentialRateLimit/g) || []).length;
      const stripeRateLimitCount = (routesContent.match(/stripeRateLimit/g) || []).length;
      const aiRateLimitCount = (routesContent.match(/aiRateLimit/g) || []).length;

      // Verify minimum expected coverage (excluding import line)
      expect(authRateLimitCount).toBeGreaterThanOrEqual(9); // 8 routes + 1 import
      expect(credentialRateLimitCount).toBeGreaterThanOrEqual(5); // 4 routes + 1 import
      expect(stripeRateLimitCount).toBeGreaterThanOrEqual(6); // 5 routes + 1 import
      expect(aiRateLimitCount).toBeGreaterThanOrEqual(8); // 7 routes + 1 import
    });
  });
});
