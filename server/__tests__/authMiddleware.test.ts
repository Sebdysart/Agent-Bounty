/**
 * AuthMiddleware Tests - Authentication and authorization middleware
 *
 * Tests the middleware functions for:
 * - JWT validation (validateJWT)
 * - JWT requirement (requireJWT)
 * - Role-based access control (requireRole)
 * - Permission-based access control (requirePermission)
 * - Admin access verification (requireAdmin)
 * - Hybrid authentication (hybridAuth, hybridAuthWithRoles)
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock jwtService - must use inline factory to avoid hoisting issues
vi.mock('../jwtService', () => ({
  jwtService: {
    validateAccessToken: vi.fn(),
    hasPermission: vi.fn(),
    getUserRoles: vi.fn(),
  },
}));

import {
  validateJWT,
  requireJWT,
  requireRole,
  requirePermission,
  requireAdmin,
  hybridAuth,
  hybridAuthWithRoles,
} from '../authMiddleware';
import { jwtService } from '../jwtService';

// Cast mocks for TypeScript
const mockValidateAccessToken = jwtService.validateAccessToken as Mock;
const mockHasPermission = jwtService.hasPermission as Mock;
const mockGetUserRoles = jwtService.getUserRoles as Mock;

describe('AuthMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: Mock;
  let mockStatus: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockJson = vi.fn().mockReturnThis();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });

    mockReq = {
      headers: {},
    };
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
    mockNext = vi.fn();
  });

  describe('validateJWT', () => {
    it('should call next without setting tokenPayload when no authorization header', () => {
      validateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.tokenPayload).toBeUndefined();
      expect(mockValidateAccessToken).not.toHaveBeenCalled();
    });

    it('should call next without setting tokenPayload when auth header does not start with Bearer', () => {
      mockReq.headers = { authorization: 'Basic sometoken' };

      validateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.tokenPayload).toBeUndefined();
      expect(mockValidateAccessToken).not.toHaveBeenCalled();
    });

    it('should validate token and set tokenPayload when valid Bearer token provided', () => {
      const mockPayload = {
        userId: 'user-123',
        roles: ['editor'],
        permissions: ['bounty:read', 'bounty:write'],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id-123',
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockValidateAccessToken.mockReturnValue(mockPayload);

      validateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockReq.tokenPayload).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting tokenPayload when token is invalid', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      mockValidateAccessToken.mockReturnValue(null);

      validateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateAccessToken).toHaveBeenCalledWith('invalid-token');
      expect(mockReq.tokenPayload).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should correctly extract token when Bearer prefix has proper spacing', () => {
      mockReq.headers = { authorization: 'Bearer my-test-token-123' };
      mockValidateAccessToken.mockReturnValue(null);

      validateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateAccessToken).toHaveBeenCalledWith('my-test-token-123');
    });
  });

  describe('requireJWT', () => {
    it('should return 401 when no authorization header', () => {
      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when auth header does not start with Bearer', () => {
      mockReq.headers = { authorization: 'Basic token123' };

      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid or expired', () => {
      mockReq.headers = { authorization: 'Bearer expired-token' };
      mockValidateAccessToken.mockReturnValue(null);

      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateAccessToken).toHaveBeenCalledWith('expired-token');
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Invalid or expired access token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set tokenPayload and call next when token is valid', () => {
      const mockPayload = {
        userId: 'user-456',
        roles: ['admin'],
        permissions: ['*:*'],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id-456',
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockValidateAccessToken.mockReturnValue(mockPayload);

      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.tokenPayload).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 when no tokenPayload', () => {
      const middleware = requireRole('admin');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: ['viewer'],
        permissions: [],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      const middleware = requireRole('admin');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user has the required role', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: ['admin', 'editor'],
        permissions: [],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      const middleware = requireRole('admin');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should call next when user has any of the required roles', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: ['editor'],
        permissions: [],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      const middleware = requireRole('admin', 'editor', 'moderator');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should return 403 when user has none of the required roles', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: ['viewer'],
        permissions: [],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      const middleware = requireRole('admin', 'editor', 'moderator');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
    });
  });

  describe('requirePermission', () => {
    it('should return 401 when no tokenPayload', () => {
      const middleware = requirePermission('bounty', 'write');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required permission', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: ['viewer'],
        permissions: ['bounty:read'],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      mockHasPermission.mockReturnValue(false);
      const middleware = requirePermission('bounty', 'delete');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockHasPermission).toHaveBeenCalledWith(
        mockReq.tokenPayload,
        'bounty',
        'delete'
      );
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user has required permission', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: ['editor'],
        permissions: ['bounty:read', 'bounty:write'],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      mockHasPermission.mockReturnValue(true);
      const middleware = requirePermission('bounty', 'write');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockHasPermission).toHaveBeenCalledWith(
        mockReq.tokenPayload,
        'bounty',
        'write'
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should return 401 when no user or tokenPayload', async () => {
      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user has admin role from jwtService', async () => {
      (mockReq as any).user = { claims: { sub: 'user-admin-123' } };
      mockGetUserRoles.mockResolvedValue(['admin']);

      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockGetUserRoles).toHaveBeenCalledWith('user-admin-123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should call next when user is in ADMIN_USER_IDS environment variable', async () => {
      const originalEnv = process.env.ADMIN_USER_IDS;
      process.env.ADMIN_USER_IDS = 'user-1,user-2,user-admin-env';

      (mockReq as any).user = { claims: { sub: 'user-admin-env' } };
      mockGetUserRoles.mockResolvedValue(['viewer']);

      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).not.toHaveBeenCalled();

      process.env.ADMIN_USER_IDS = originalEnv;
    });

    it('should return 403 when user is not admin and not in ADMIN_USER_IDS', async () => {
      const originalEnv = process.env.ADMIN_USER_IDS;
      process.env.ADMIN_USER_IDS = 'other-user-1,other-user-2';

      (mockReq as any).user = { claims: { sub: 'regular-user' } };
      mockGetUserRoles.mockResolvedValue(['viewer']);

      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Admin access required' });
      expect(mockNext).not.toHaveBeenCalled();

      process.env.ADMIN_USER_IDS = originalEnv;
    });

    it('should use tokenPayload userId when session userId is not available', async () => {
      (mockReq as any).tokenPayload = { userId: 'jwt-user-123' };
      mockGetUserRoles.mockResolvedValue(['admin']);

      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockGetUserRoles).toHaveBeenCalledWith('jwt-user-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prefer session userId over tokenPayload userId', async () => {
      (mockReq as any).user = { claims: { sub: 'session-user' } };
      (mockReq as any).tokenPayload = { userId: 'jwt-user' };
      mockGetUserRoles.mockResolvedValue(['admin']);

      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockGetUserRoles).toHaveBeenCalledWith('session-user');
    });
  });

  describe('hybridAuth', () => {
    it('should return 401 when neither session nor JWT auth present', () => {
      hybridAuth(mockReq as any, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set authUserId and authRoles from JWT when available', () => {
      (mockReq as any).tokenPayload = {
        userId: 'jwt-user-123',
        roles: ['editor', 'contributor'],
      };

      hybridAuth(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('jwt-user-123');
      expect((mockReq as any).authRoles).toEqual(['editor', 'contributor']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set authUserId from session and default authRoles to viewer when no JWT', () => {
      (mockReq as any).user = { claims: { sub: 'session-user-456' } };

      hybridAuth(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('session-user-456');
      expect((mockReq as any).authRoles).toEqual(['viewer']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prefer JWT userId over session userId', () => {
      (mockReq as any).user = { claims: { sub: 'session-user' } };
      (mockReq as any).tokenPayload = {
        userId: 'jwt-user',
        roles: ['admin'],
      };

      hybridAuth(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('jwt-user');
      expect((mockReq as any).authRoles).toEqual(['admin']);
    });
  });

  describe('hybridAuthWithRoles', () => {
    it('should return 401 when neither session nor JWT auth present', async () => {
      await hybridAuthWithRoles(mockReq as any, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use JWT roles when available', async () => {
      (mockReq as any).tokenPayload = {
        userId: 'jwt-user-123',
        roles: ['admin', 'editor'],
      };

      await hybridAuthWithRoles(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('jwt-user-123');
      expect((mockReq as any).authRoles).toEqual(['admin', 'editor']);
      expect(mockGetUserRoles).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fetch roles from database when session auth and no JWT roles', async () => {
      (mockReq as any).user = { claims: { sub: 'session-user-789' } };
      mockGetUserRoles.mockResolvedValue(['contributor']);

      await hybridAuthWithRoles(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('session-user-789');
      expect(mockGetUserRoles).toHaveBeenCalledWith('session-user-789');
      expect((mockReq as any).authRoles).toEqual(['contributor']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prefer JWT userId and roles over session', async () => {
      (mockReq as any).user = { claims: { sub: 'session-user' } };
      (mockReq as any).tokenPayload = {
        userId: 'jwt-user',
        roles: ['moderator'],
      };

      await hybridAuthWithRoles(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('jwt-user');
      expect((mockReq as any).authRoles).toEqual(['moderator']);
      expect(mockGetUserRoles).not.toHaveBeenCalled();
    });

    it('should use session userId but fetch roles when only session available', async () => {
      (mockReq as any).user = { claims: { sub: 'db-roles-user' } };
      mockGetUserRoles.mockResolvedValue(['viewer', 'tester']);

      await hybridAuthWithRoles(mockReq as any, mockRes as Response, mockNext);

      expect((mockReq as any).authUserId).toBe('db-roles-user');
      expect((mockReq as any).authRoles).toEqual(['viewer', 'tester']);
      expect(mockGetUserRoles).toHaveBeenCalledWith('db-roles-user');
    });
  });

  describe('edge cases', () => {
    it('should handle empty authorization header', () => {
      mockReq.headers = { authorization: '' };

      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Access token required' });
    });

    it('should handle Bearer with no token', () => {
      mockReq.headers = { authorization: 'Bearer ' };
      mockValidateAccessToken.mockReturnValue(null);

      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateAccessToken).toHaveBeenCalledWith('');
      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it('should handle malformed bearer token gracefully', () => {
      mockReq.headers = { authorization: 'Bearer malformed.token' };
      mockValidateAccessToken.mockReturnValue(null);

      requireJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateAccessToken).toHaveBeenCalledWith('malformed.token');
      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it('should handle empty roles array in requireRole', () => {
      mockReq.tokenPayload = {
        userId: 'user-123',
        roles: [],
        permissions: [],
        exp: Date.now() + 10000,
        iat: Date.now(),
        jti: 'token-id',
      };
      const middleware = requireRole('admin');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    it('should handle undefined ADMIN_USER_IDS', async () => {
      const originalEnv = process.env.ADMIN_USER_IDS;
      delete process.env.ADMIN_USER_IDS;

      (mockReq as any).user = { claims: { sub: 'regular-user' } };
      mockGetUserRoles.mockResolvedValue(['viewer']);

      await requireAdmin(mockReq as any, mockRes as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Admin access required' });

      process.env.ADMIN_USER_IDS = originalEnv;
    });
  });
});
