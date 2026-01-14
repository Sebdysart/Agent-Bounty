/**
 * Simple sanity test to verify test infrastructure works
 */

import { describe, it, expect, vi } from 'vitest';
import { testUtils } from './setup';
import { factories } from './factories';

describe('Test Infrastructure', () => {
  describe('Setup', () => {
    it('should have test environment configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have testUtils available globally', () => {
      expect(testUtils).toBeDefined();
      expect(testUtils.mockRequest).toBeDefined();
      expect(testUtils.mockResponse).toBeDefined();
      expect(testUtils.mockNext).toBeDefined();
    });

    it('should create mock request correctly', () => {
      const req = testUtils.mockRequest({ body: { test: true } });
      expect(req.user.claims.sub).toBe('test-user-id');
      expect(req.body.test).toBe(true);
    });

    it('should create mock response correctly', () => {
      const res = testUtils.mockResponse();
      res.status(201).json({ success: true });
      expect(res.statusCode).toBe(201);
      expect(res._json).toEqual({ success: true });
    });
  });

  describe('Factories', () => {
    it('should create user with defaults', () => {
      const user = factories.createUser();
      expect(user.id).toMatch(/^user-\d+$/);
      expect(user.email).toMatch(/@example\.com$/);
      expect(user.role).toBe('business');
    });

    it('should create user with overrides', () => {
      const user = factories.createUser({ role: 'admin', isAdmin: true });
      expect(user.role).toBe('admin');
      expect(user.isAdmin).toBe(true);
    });

    it('should create bounty with defaults', () => {
      const bounty = factories.createBounty();
      expect(bounty.id).toBeGreaterThan(0);
      expect(bounty.status).toBe('open');
      expect(bounty.paymentStatus).toBe('pending');
      expect(bounty.reward).toBe('100.00');
    });

    it('should create agent with defaults', () => {
      const agent = factories.createAgent();
      expect(agent.id).toBeGreaterThan(0);
      expect(agent.capabilities).toContain('testing');
      expect(agent.isVerified).toBe(false);
    });

    it('should create submission with defaults', () => {
      const submission = factories.createSubmission();
      expect(submission.id).toBeGreaterThan(0);
      expect(submission.status).toBe('pending');
      expect(submission.progress).toBe(0);
    });

    it('should create stored credentials with defaults', () => {
      const creds = factories.createStoredCredentials();
      expect(creds.credentials.apiKey).toBe('test-api-key');
      expect(creds.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reset id counter', () => {
      factories.resetIdCounter();
      const bounty1 = factories.createBounty();
      factories.resetIdCounter();
      const bounty2 = factories.createBounty();
      expect(bounty1.id).toBe(bounty2.id);
    });
  });
});
