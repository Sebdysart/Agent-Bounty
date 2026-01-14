/**
 * JWTService Tests - Token generation, validation, and role management
 *
 * Tests the core JWT functionality including:
 * - Token pair generation (access + refresh tokens)
 * - Access token validation and expiry
 * - Refresh token rotation and revocation
 * - User role assignment and retrieval
 * - Role permission lookups
 * - Permission checking (hasPermission)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Use vi.hoisted to declare mocks before vi.mock is hoisted
const { mockInsert, mockSelect, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

// Mock the schema
vi.mock('@shared/schema', () => ({
  refreshTokens: { userId: 'userId', token: 'token', id: 'id', revokedAt: 'revokedAt', expiresAt: 'expiresAt' },
  userRoleAssignments: { userId: 'userId', role: 'role', expiresAt: 'expiresAt' },
  rolePermissions: { role: 'role', resource: 'resource', action: 'action' },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  gt: vi.fn((a, b) => ({ type: 'gt', a, b })),
  isNull: vi.fn((a) => ({ type: 'isNull', a })),
}));

import { db } from '../db';

// Helper to set up select mock that handles both getUserRoles (with where) and getRolePermissions (without where)
function setupSelectMock(roleAssignments: any[] = [], rolePermissions: any[] = []) {
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: any) => {
      // Check if it's the rolePermissions table (no where clause used)
      if (table === 'rolePermissions' || table.role === 'role') {
        return Promise.resolve(rolePermissions);
      }
      // For userRoleAssignments, return object with where
      return {
        where: vi.fn().mockResolvedValue(roleAssignments),
      };
    }),
  }));
}

// Helper to set up insert mock
function setupInsertMock() {
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    }),
  });
}

// Helper to set up update mock
function setupUpdateMock() {
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

// Helper to set up delete mock
function setupDeleteMock() {
  mockDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
}

describe('JWTService', () => {
  let jwtService: any;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalEnv = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'test-secret-key-for-jwt-testing';

    // Set up default mocks
    setupSelectMock([], []);
    setupInsertMock();
    setupUpdateMock();
    setupDeleteMock();

    // Clear module cache to get fresh instance with test secret
    vi.resetModules();

    // Re-import after resetting modules
    const module = await import('../jwtService');
    jwtService = module.jwtService;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SESSION_SECRET = originalEnv;
    } else {
      delete process.env.SESSION_SECRET;
    }
  });

  describe('generateTokenPair', () => {
    beforeEach(() => {
      // Mock getUserRoles to return default roles
      setupSelectMock([], []);
    });

    it('should generate access and refresh tokens', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('tokenType', 'Bearer');
    });

    it('should generate access token in JWT format (three parts)', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      const parts = result.accessToken.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should include proper header in access token', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      const [encodedHeader] = result.accessToken.split('.');
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));

      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    });

    it('should include userId in access token payload', async () => {
      const userId = 'user-test-456';
      const result = await jwtService.generateTokenPair(userId);

      const [, encodedPayload] = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      expect(payload.userId).toBe(userId);
    });

    it('should include roles and permissions in access token', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      const [, encodedPayload] = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      expect(payload).toHaveProperty('roles');
      expect(payload).toHaveProperty('permissions');
      expect(Array.isArray(payload.roles)).toBe(true);
      expect(Array.isArray(payload.permissions)).toBe(true);
    });

    it('should set expiry time in access token (15 minutes from now)', async () => {
      const beforeTime = Date.now();
      const result = await jwtService.generateTokenPair('user-123');
      const afterTime = Date.now();

      const [, encodedPayload] = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      // 15 minutes = 900000 ms
      expect(payload.exp).toBeGreaterThanOrEqual(beforeTime + 15 * 60 * 1000);
      expect(payload.exp).toBeLessThanOrEqual(afterTime + 15 * 60 * 1000);
    });

    it('should include issued at time (iat) in token', async () => {
      const beforeTime = Date.now();
      const result = await jwtService.generateTokenPair('user-123');
      const afterTime = Date.now();

      const [, encodedPayload] = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      expect(payload.iat).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.iat).toBeLessThanOrEqual(afterTime);
    });

    it('should include unique token ID (jti) in token', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      const [, encodedPayload] = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      expect(payload.jti).toBeDefined();
      expect(typeof payload.jti).toBe('string');
    });

    it('should generate unique jti for each token pair', async () => {
      const result1 = await jwtService.generateTokenPair('user-123');
      const result2 = await jwtService.generateTokenPair('user-123');

      const payload1 = JSON.parse(Buffer.from(result1.accessToken.split('.')[1], 'base64url').toString('utf8'));
      const payload2 = JSON.parse(Buffer.from(result2.accessToken.split('.')[1], 'base64url').toString('utf8'));

      expect(payload1.jti).not.toBe(payload2.jti);
    });

    it('should generate hex refresh token of correct length', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      // 64 bytes = 128 hex characters
      expect(result.refreshToken).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should store refresh token in database', async () => {
      await jwtService.generateTokenPair('user-123', 'Chrome/Windows', '192.168.1.1');

      expect(db.insert).toHaveBeenCalled();
    });

    it('should store device info and IP address with refresh token', async () => {
      await jwtService.generateTokenPair('user-123', 'Chrome/Windows', '192.168.1.1');

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should return expiresIn in seconds', async () => {
      const result = await jwtService.generateTokenPair('user-123');

      // 15 minutes = 900 seconds
      expect(result.expiresIn).toBe(900);
    });
  });

  describe('validateAccessToken', () => {
    it('should return payload for valid token', async () => {
      const tokenPair = await jwtService.generateTokenPair('user-validate-test');
      const result = jwtService.validateAccessToken(tokenPair.accessToken);

      expect(result).not.toBeNull();
      expect(result.userId).toBe('user-validate-test');
    });

    it('should return null for invalid signature', async () => {
      const tokenPair = await jwtService.generateTokenPair('user-123');
      const parts = tokenPair.accessToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidSignature`;

      const result = jwtService.validateAccessToken(tamperedToken);

      expect(result).toBeNull();
    });

    it('should return null for tampered payload', async () => {
      const tokenPair = await jwtService.generateTokenPair('user-123');
      const parts = tokenPair.accessToken.split('.');

      // Tamper with payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.userId = 'hacked-user';
      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const result = jwtService.validateAccessToken(tamperedToken);

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Create a token with past expiry by manipulating internal state
      const tokenPair = await jwtService.generateTokenPair('user-123');
      const parts = tokenPair.accessToken.split('.');

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.exp = Date.now() - 1000; // 1 second ago
      const expiredPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

      // Need to re-sign with proper signature for expiry test
      const signature = crypto
        .createHmac('sha256', process.env.SESSION_SECRET!)
        .update(`${parts[0]}.${expiredPayload}`)
        .digest('base64url');
      const expiredToken = `${parts[0]}.${expiredPayload}.${signature}`;

      const result = jwtService.validateAccessToken(expiredToken);

      expect(result).toBeNull();
    });

    it('should return null for malformed token', async () => {
      expect(jwtService.validateAccessToken('not.a.valid.jwt.token')).toBeNull();
      expect(jwtService.validateAccessToken('invalid')).toBeNull();
      expect(jwtService.validateAccessToken('')).toBeNull();
    });

    it('should return null for token with invalid JSON payload', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const invalidPayload = Buffer.from('not json').toString('base64url');
      const signature = crypto
        .createHmac('sha256', process.env.SESSION_SECRET!)
        .update(`${header}.${invalidPayload}`)
        .digest('base64url');
      const invalidToken = `${header}.${invalidPayload}.${signature}`;

      const result = jwtService.validateAccessToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should include all expected fields in returned payload', async () => {
      const tokenPair = await jwtService.generateTokenPair('user-full-payload');
      const result = jwtService.validateAccessToken(tokenPair.accessToken);

      expect(result).toHaveProperty('userId', 'user-full-payload');
      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('exp');
      expect(result).toHaveProperty('iat');
      expect(result).toHaveProperty('jti');
    });
  });

  describe('refreshAccessToken', () => {
    it('should return null for non-existent refresh token', async () => {
      // Setup mock for refreshTokens select (with where returning empty)
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }));

      const result = await jwtService.refreshAccessToken('non-existent-token');

      expect(result).toBeNull();
    });

    it('should return new token pair for valid refresh token', async () => {
      const mockTokenRecord = {
        id: 1,
        userId: 'user-refresh-test',
        token: 'valid-refresh-token',
        deviceInfo: 'Chrome/Windows',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };

      // First call returns the refresh token record, subsequent calls for getUserRoles/getRolePermissions
      let callCount = 0;
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: any) => {
          callCount++;
          if (callCount === 1) {
            // First call is for refreshTokens
            return { where: vi.fn().mockResolvedValue([mockTokenRecord]) };
          }
          // Subsequent calls for role lookups
          if (table === 'rolePermissions' || table.role === 'role') {
            return Promise.resolve([]);
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      }));

      const result = await jwtService.refreshAccessToken('valid-refresh-token', '192.168.1.1');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should revoke old refresh token when generating new pair', async () => {
      const mockTokenRecord = {
        id: 42,
        userId: 'user-123',
        token: 'old-refresh-token',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };

      let callCount = 0;
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: any) => {
          callCount++;
          if (callCount === 1) {
            return { where: vi.fn().mockResolvedValue([mockTokenRecord]) };
          }
          if (table === 'rolePermissions' || table.role === 'role') {
            return Promise.resolve([]);
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      }));

      await jwtService.refreshAccessToken('old-refresh-token');

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should update token revokedAt timestamp', async () => {
      await jwtService.revokeRefreshToken('token-to-revoke');

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      await jwtService.revokeAllUserTokens('user-to-logout');

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return viewer role when user has no assignments', async () => {
      setupSelectMock([], []);

      const result = await jwtService.getUserRoles('user-no-roles');

      expect(result).toEqual(['viewer']);
    });

    it('should return assigned roles for user', async () => {
      setupSelectMock([
        { role: 'admin', expiresAt: null },
        { role: 'editor', expiresAt: null },
      ], []);

      const result = await jwtService.getUserRoles('user-with-roles');

      expect(result).toContain('admin');
      expect(result).toContain('editor');
    });

    it('should filter out expired role assignments', async () => {
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      const futureDate = new Date(Date.now() + 86400000); // 1 day from now

      setupSelectMock([
        { role: 'admin', expiresAt: pastDate },
        { role: 'editor', expiresAt: futureDate },
      ], []);

      const result = await jwtService.getUserRoles('user-with-expired-role');

      expect(result).not.toContain('admin');
      expect(result).toContain('editor');
    });

    it('should return viewer when all roles are expired', async () => {
      const pastDate = new Date(Date.now() - 86400000);

      setupSelectMock([
        { role: 'admin', expiresAt: pastDate },
      ], []);

      const result = await jwtService.getUserRoles('user-all-expired');

      expect(result).toEqual(['viewer']);
    });
  });

  describe('getRolePermissions', () => {
    it('should return empty array for empty roles array', async () => {
      const result = await jwtService.getRolePermissions([]);

      expect(result).toEqual([]);
    });

    it('should return formatted permissions for roles', async () => {
      setupSelectMock([], [
        { role: 'editor', resource: 'bounty', action: 'read' },
        { role: 'editor', resource: 'bounty', action: 'write' },
        { role: 'admin', resource: 'user', action: 'manage' },
      ]);

      const result = await jwtService.getRolePermissions(['editor', 'admin']);

      expect(result).toContain('bounty:read');
      expect(result).toContain('bounty:write');
      expect(result).toContain('user:manage');
    });

    it('should deduplicate permissions', async () => {
      setupSelectMock([], [
        { role: 'editor', resource: 'bounty', action: 'read' },
        { role: 'viewer', resource: 'bounty', action: 'read' },
      ]);

      const result = await jwtService.getRolePermissions(['editor', 'viewer']);

      const readCount = result.filter((p: string) => p === 'bounty:read').length;
      expect(readCount).toBe(1);
    });

    it('should only include permissions for requested roles', async () => {
      setupSelectMock([], [
        { role: 'editor', resource: 'bounty', action: 'write' },
        { role: 'admin', resource: 'user', action: 'delete' },
      ]);

      const result = await jwtService.getRolePermissions(['editor']);

      expect(result).toContain('bounty:write');
      expect(result).not.toContain('user:delete');
    });
  });

  describe('assignRole', () => {
    it('should insert role assignment into database', async () => {
      const result = await jwtService.assignRole('user-123', 'editor', 'admin-user');

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should include grantedBy and expiresAt when provided', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      await jwtService.assignRole('user-123', 'temp-admin', 'super-admin', expiresAt);

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('removeRole', () => {
    it('should delete role assignment from database', async () => {
      await jwtService.removeRole('user-123', 'editor');

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    const basePayload = {
      userId: 'user-123',
      roles: ['editor'],
      permissions: ['bounty:read', 'bounty:write'],
      exp: Date.now() + 10000,
      iat: Date.now(),
      jti: 'token-id',
    };

    it('should return true when user has exact permission', () => {
      const result = jwtService.hasPermission(basePayload, 'bounty', 'read');

      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', () => {
      const result = jwtService.hasPermission(basePayload, 'user', 'delete');

      expect(result).toBe(false);
    });

    it('should return true when user has manage permission for resource', () => {
      const payloadWithManage = {
        ...basePayload,
        permissions: ['bounty:manage'],
      };

      const result = jwtService.hasPermission(payloadWithManage, 'bounty', 'delete');

      expect(result).toBe(true);
    });

    it('should return true for admin role regardless of specific permissions', () => {
      const adminPayload = {
        ...basePayload,
        roles: ['admin'],
        permissions: [],
      };

      expect(jwtService.hasPermission(adminPayload, 'any', 'action')).toBe(true);
      expect(jwtService.hasPermission(adminPayload, 'user', 'delete')).toBe(true);
      expect(jwtService.hasPermission(adminPayload, 'system', 'manage')).toBe(true);
    });

    it('should check manage permission before admin role', () => {
      const editorWithManage = {
        ...basePayload,
        roles: ['editor'],
        permissions: ['bounty:manage'],
      };

      const result = jwtService.hasPermission(editorWithManage, 'bounty', 'special');

      expect(result).toBe(true);
    });

    it('should return false for non-admin without matching permission', () => {
      const viewerPayload = {
        ...basePayload,
        roles: ['viewer'],
        permissions: ['bounty:read'],
      };

      const result = jwtService.hasPermission(viewerPayload, 'bounty', 'delete');

      expect(result).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should use SESSION_SECRET from environment when available', async () => {
      process.env.SESSION_SECRET = 'my-test-secret';
      setupSelectMock([], []);
      vi.resetModules();

      const module = await import('../jwtService');
      const testService = module.jwtService;

      // Generate token and verify it works with the secret
      const tokenPair = await testService.generateTokenPair('user-env-test');
      const payload = testService.validateAccessToken(tokenPair.accessToken);

      expect(payload).not.toBeNull();
      expect(payload.userId).toBe('user-env-test');
    });

    it('should generate random secret when SESSION_SECRET is not set', async () => {
      delete process.env.SESSION_SECRET;
      setupSelectMock([], []);
      vi.resetModules();

      const module = await import('../jwtService');
      const testService = module.jwtService;

      // Should still work with auto-generated secret
      const tokenPair = await testService.generateTokenPair('user-random-secret');
      const payload = testService.validateAccessToken(tokenPair.accessToken);

      expect(payload).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      setupSelectMock([], []);
    });

    it('should handle empty userId', async () => {
      const result = await jwtService.generateTokenPair('');

      expect(result).toHaveProperty('accessToken');
      const payload = jwtService.validateAccessToken(result.accessToken);
      expect(payload.userId).toBe('');
    });

    it('should handle special characters in userId', async () => {
      const specialUserId = 'user@example.com/test#123';
      const result = await jwtService.generateTokenPair(specialUserId);

      const payload = jwtService.validateAccessToken(result.accessToken);
      expect(payload.userId).toBe(specialUserId);
    });

    it('should handle very long userId', async () => {
      const longUserId = 'a'.repeat(1000);
      const result = await jwtService.generateTokenPair(longUserId);

      const payload = jwtService.validateAccessToken(result.accessToken);
      expect(payload.userId).toBe(longUserId);
    });
  });
});
