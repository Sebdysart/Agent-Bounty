import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCsrfToken,
  ensureCsrfToken,
  validateCsrfToken,
  getCsrfTokenHandler,
  csrfProtection,
} from '../csrfMiddleware';
import { testUtils } from './setup';

describe('csrfMiddleware', () => {
  describe('generateCsrfToken', () => {
    it('generates a 64 character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('generates unique tokens each time', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('ensureCsrfToken', () => {
    it('creates CSRF token if not present in session', () => {
      const req: any = {
        session: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      ensureCsrfToken(req, res, next);

      expect(req.session.csrfToken).toBeDefined();
      expect(req.session.csrfToken).toHaveLength(64);
      expect(next).toHaveBeenCalled();
    });

    it('preserves existing CSRF token', () => {
      const existingToken = 'existing-token-value';
      const req: any = {
        session: { csrfToken: existingToken },
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      ensureCsrfToken(req, res, next);

      expect(req.session.csrfToken).toBe(existingToken);
      expect(next).toHaveBeenCalled();
    });

    it('handles missing session gracefully', () => {
      const req: any = {};
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      ensureCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateCsrfToken', () => {
    it('allows GET requests without token', () => {
      const req: any = {
        method: 'GET',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows HEAD requests without token', () => {
      const req: any = {
        method: 'HEAD',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows OPTIONS requests without token', () => {
      const req: any = {
        method: 'OPTIONS',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('rejects POST request without session token', () => {
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error.code).toBe('CSRF_NO_SESSION');
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects POST request without request token', () => {
      const sessionToken = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: {},
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error.code).toBe('CSRF_TOKEN_MISSING');
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects POST request with invalid token', () => {
      const sessionToken = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: { 'x-csrf-token': 'wrong-token' },
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error.code).toBe('CSRF_TOKEN_INVALID');
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts POST request with valid header token', () => {
      const sessionToken = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: { 'x-csrf-token': sessionToken },
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('accepts POST request with valid body token', () => {
      const sessionToken = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: {},
        body: { _csrf: sessionToken },
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('validates PUT requests', () => {
      const req: any = {
        method: 'PUT',
        path: '/api/bounties/1',
        session: {},
        headers: {},
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('validates PATCH requests', () => {
      const req: any = {
        method: 'PATCH',
        path: '/api/bounties/1',
        session: {},
        headers: {},
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('validates DELETE requests', () => {
      const req: any = {
        method: 'DELETE',
        path: '/api/bounties/1',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('skips validation for Stripe webhook', () => {
      const req: any = {
        method: 'POST',
        path: '/api/stripe/webhook',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips validation for OAuth callback', () => {
      const req: any = {
        method: 'POST',
        path: '/api/callback',
        session: {},
        headers: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips validation for JWT-authenticated requests', () => {
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: {},
        headers: { authorization: 'Bearer some-jwt-token' },
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getCsrfTokenHandler', () => {
    it('returns existing CSRF token', () => {
      const existingToken = generateCsrfToken();
      const req: any = {
        session: { csrfToken: existingToken },
      };
      const res = testUtils.mockResponse();

      getCsrfTokenHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: { csrfToken: existingToken } });
    });

    it('creates and returns new token if none exists', () => {
      const req: any = {
        session: {},
      };
      const res = testUtils.mockResponse();

      getCsrfTokenHandler(req, res);

      expect(req.session.csrfToken).toBeDefined();
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { csrfToken: req.session.csrfToken } });
    });

    it('returns 500 if session unavailable', () => {
      const req: any = {};
      const res = testUtils.mockResponse();

      getCsrfTokenHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json.error.message).toBe('Session not available');
    });
  });

  describe('csrfProtection', () => {
    it('combines ensureCsrfToken and validateCsrfToken', () => {
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: {},
        headers: {},
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      // First, token should be created
      // But validation should fail (no token in request)
      csrfProtection(req, res, next);

      expect(req.session.csrfToken).toBeDefined();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('passes with valid token after ensuring', () => {
      const sessionToken = generateCsrfToken();
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: { 'x-csrf-token': sessionToken },
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('timing attack prevention', () => {
    it('rejects tokens with same length but different content', () => {
      const sessionToken = 'a'.repeat(64);
      const attackToken = 'b'.repeat(64);
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: { 'x-csrf-token': attackToken },
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('rejects tokens with different lengths', () => {
      const sessionToken = generateCsrfToken();
      const attackToken = sessionToken + 'extra';
      const req: any = {
        method: 'POST',
        path: '/api/bounties',
        session: { csrfToken: sessionToken },
        headers: { 'x-csrf-token': attackToken },
        body: {},
      };
      const res = testUtils.mockResponse();
      const next = testUtils.mockNext();

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json.error.code).toBe('CSRF_TOKEN_INVALID');
    });
  });
});
