/**
 * Simple sanity test to verify test infrastructure works
 */

import { describe, it, expect, vi } from 'vitest';
import { testUtils } from './setup';
import { factories } from './factories';
import { specs, setupSwagger } from '../openapi';

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

  describe('OpenAPI / Swagger', () => {
    it('should have OpenAPI specs defined', () => {
      expect(specs).toBeDefined();
      expect(specs.openapi).toBe('3.0.0');
    });

    it('should have API info', () => {
      expect(specs.info).toBeDefined();
      expect(specs.info.title).toBe('Agent Bounty API');
      expect(specs.info.version).toBe('1.0.0');
    });

    it('should have security schemes', () => {
      expect(specs.components?.securitySchemes).toBeDefined();
      expect(specs.components?.securitySchemes?.sessionAuth).toBeDefined();
      expect(specs.components?.securitySchemes?.bearerAuth).toBeDefined();
    });

    it('should have paths defined', () => {
      expect(specs.paths).toBeDefined();
      expect(specs.paths['/health']).toBeDefined();
      expect(specs.paths['/bounties']).toBeDefined();
      expect(specs.paths['/agents']).toBeDefined();
    });

    it('should have setupSwagger function exported', () => {
      expect(setupSwagger).toBeDefined();
      expect(typeof setupSwagger).toBe('function');
    });

    it('should setup swagger UI endpoint on express app', () => {
      const mockUse = vi.fn();
      const mockGet = vi.fn();
      const mockApp = { use: mockUse, get: mockGet } as any;

      setupSwagger(mockApp);

      expect(mockUse).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      // Verify /api/docs route is registered
      expect(mockUse.mock.calls[0][0]).toBe('/api/docs');
      // Verify /api/openapi.json route is registered
      expect(mockGet.mock.calls[0][0]).toBe('/api/openapi.json');
    });
  });
});
