/**
 * EncryptedVault Tests - Credential encryption and vault functionality
 *
 * Tests the core encryption/decryption functions and the EncryptedVault class:
 * - AES-256-GCM encryption/decryption
 * - Credential storage (set/get/delete)
 * - Cache behavior and database persistence
 * - Expiration handling
 * - Metadata operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to declare mocks before vi.mock is hoisted
const { mockExecute, mockMemoryCache } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockMemoryCache: { value: new Map<number, any>() },
}));

// Mock the database
vi.mock('../db', () => ({
  db: {
    execute: mockExecute,
  },
}));

// Mock drizzle-orm sql tag
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({
    strings,
    values,
    _tag: 'sql',
  }),
}));

describe('EncryptedVault', () => {
  let encrypt: (plaintext: string) => string;
  let decrypt: (encryptedString: string) => string;
  let encryptedVault: any;
  let originalEnv: {
    CREDENTIAL_ENCRYPTION_KEY?: string;
    CREDENTIAL_ENCRYPTION_SALT?: string;
    SESSION_SECRET?: string;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMemoryCache.value.clear();

    // Save original environment
    originalEnv = {
      CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY,
      CREDENTIAL_ENCRYPTION_SALT: process.env.CREDENTIAL_ENCRYPTION_SALT,
      SESSION_SECRET: process.env.SESSION_SECRET,
    };

    // Set test environment
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key';
    process.env.SESSION_SECRET = 'test-session-secret';

    // Setup default mock for ensureTable
    mockExecute.mockResolvedValue({ rows: [] });

    // Clear module cache and re-import
    vi.resetModules();

    const module = await import('../encryptedVault');
    encrypt = module.encrypt;
    decrypt = module.decrypt;
    encryptedVault = module.encryptedVault;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv.CREDENTIAL_ENCRYPTION_KEY !== undefined) {
      process.env.CREDENTIAL_ENCRYPTION_KEY = originalEnv.CREDENTIAL_ENCRYPTION_KEY;
    } else {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    }
    if (originalEnv.CREDENTIAL_ENCRYPTION_SALT !== undefined) {
      process.env.CREDENTIAL_ENCRYPTION_SALT = originalEnv.CREDENTIAL_ENCRYPTION_SALT;
    } else {
      delete process.env.CREDENTIAL_ENCRYPTION_SALT;
    }
    if (originalEnv.SESSION_SECRET !== undefined) {
      process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
    } else {
      delete process.env.SESSION_SECRET;
    }
  });

  describe('encrypt function', () => {
    it('should encrypt plaintext and return base64 encoded string', () => {
      const plaintext = 'my-secret-data';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      // Should be base64 encoded
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'test-data';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encode encrypted data as JSON with iv, authTag, and data fields', () => {
      const plaintext = 'test';
      const encrypted = encrypt(plaintext);

      const decoded = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));

      expect(decoded).toHaveProperty('iv');
      expect(decoded).toHaveProperty('authTag');
      expect(decoded).toHaveProperty('data');
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'"<>,.?/~`\n\t';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 Привет мир';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON strings', () => {
      const plaintext = JSON.stringify({ key: 'value', nested: { arr: [1, 2, 3] } });
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual({ key: 'value', nested: { arr: [1, 2, 3] } });
    });
  });

  describe('decrypt function', () => {
    it('should decrypt encrypted data back to original plaintext', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid base64 input', () => {
      expect(() => decrypt('not-valid-base64!!!')).toThrow();
    });

    it('should throw on malformed JSON', () => {
      const invalidJson = Buffer.from('not json').toString('base64');
      expect(() => decrypt(invalidJson)).toThrow();
    });

    it('should throw on tampered ciphertext', () => {
      const plaintext = 'sensitive data';
      const encrypted = encrypt(plaintext);
      const decoded = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));

      // Tamper with the data
      decoded.data = Buffer.from('tampered').toString('base64');
      const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw on tampered authTag', () => {
      const plaintext = 'sensitive data';
      const encrypted = encrypt(plaintext);
      const decoded = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));

      // Tamper with authTag
      decoded.authTag = Buffer.from('0'.repeat(16)).toString('base64');
      const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw on tampered IV', () => {
      const plaintext = 'sensitive data';
      const encrypted = encrypt(plaintext);
      const decoded = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));

      // Tamper with IV
      decoded.iv = Buffer.from('0'.repeat(16)).toString('base64');
      const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('encryptedVault.set', () => {
    it('should store credentials in database', async () => {
      const consentId = 123;
      const data = {
        credentials: { apiKey: 'secret-key' },
        expiresAt: new Date(Date.now() + 3600000),
        userId: 'user-1',
        agentId: 1,
        requirementId: 10,
        encryptedAt: new Date(),
      };

      await encryptedVault.set(consentId, data);

      // Should have called execute for table creation and insert
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      const consentId = 456;
      const data = {
        credentials: { token: 'abc' },
        expiresAt: new Date(Date.now() + 3600000),
        userId: 'user-2',
        agentId: 2,
        requirementId: 20,
        encryptedAt: new Date(),
      };

      // Should not throw, just log error
      await expect(encryptedVault.set(consentId, data)).resolves.not.toThrow();
    });
  });

  describe('encryptedVault.get', () => {
    it('should return null for non-existent consent ID', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await encryptedVault.get(999);

      expect(result).toBeNull();
    });

    it('should return stored credentials from database', async () => {
      const consentId = 100;
      const futureDate = new Date(Date.now() + 3600000);
      const credentials = { apiKey: 'test-key' };
      const encryptedData = encrypt(JSON.stringify(credentials));

      // First calls for ensureTable, then the SELECT query
      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [{
            encrypted_data: encryptedData,
            user_id: 'user-test',
            agent_id: 5,
            requirement_id: 50,
            expires_at: futureDate.toISOString(),
            encrypted_at: new Date().toISOString(),
          }],
        });

      const result = await encryptedVault.get(consentId);

      expect(result).not.toBeNull();
      expect(result.credentials).toEqual(credentials);
      expect(result.userId).toBe('user-test');
      expect(result.agentId).toBe(5);
      expect(result.requirementId).toBe(50);
    });

    it('should return null and delete for expired credentials', async () => {
      const consentId = 200;
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const credentials = { apiKey: 'expired-key' };
      const encryptedData = encrypt(JSON.stringify(credentials));

      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [{
            encrypted_data: encryptedData,
            user_id: 'user-expired',
            agent_id: 1,
            requirement_id: 1,
            expires_at: pastDate.toISOString(),
            encrypted_at: new Date().toISOString(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      const result = await encryptedVault.get(consentId);

      expect(result).toBeNull();
    });

    it('should return null on decryption error', async () => {
      const consentId = 300;
      const futureDate = new Date(Date.now() + 3600000);

      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [{
            encrypted_data: 'invalid-encrypted-data',
            user_id: 'user-bad',
            agent_id: 1,
            requirement_id: 1,
            expires_at: futureDate.toISOString(),
            encrypted_at: new Date().toISOString(),
          }],
        });

      const result = await encryptedVault.get(consentId);

      expect(result).toBeNull();
    });
  });

  describe('encryptedVault.delete', () => {
    it('should delete credentials from database', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await encryptedVault.delete(123);

      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should return false on database error', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockRejectedValueOnce(new Error('Delete failed'));

      const result = await encryptedVault.delete(456);

      expect(result).toBe(false);
    });
  });

  describe('encryptedVault.has', () => {
    it('should return true when credential exists', async () => {
      const consentId = 400;
      const futureDate = new Date(Date.now() + 3600000);
      const credentials = { key: 'value' };
      const encryptedData = encrypt(JSON.stringify(credentials));

      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [{
            encrypted_data: encryptedData,
            user_id: 'user-has',
            agent_id: 1,
            requirement_id: 1,
            expires_at: futureDate.toISOString(),
            encrypted_at: new Date().toISOString(),
          }],
        });

      const result = await encryptedVault.has(consentId);

      expect(result).toBe(true);
    });

    it('should return false when credential does not exist', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await encryptedVault.has(999);

      expect(result).toBe(false);
    });
  });

  describe('encryptedVault.getMetadata', () => {
    it('should return metadata without credentials', async () => {
      const consentId = 500;
      const futureDate = new Date(Date.now() + 3600000);
      const encryptedAt = new Date();

      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [{
            user_id: 'user-meta',
            agent_id: 7,
            requirement_id: 70,
            expires_at: futureDate.toISOString(),
            encrypted_at: encryptedAt.toISOString(),
          }],
        });

      const result = await encryptedVault.getMetadata(consentId);

      expect(result).not.toBeNull();
      expect(result.userId).toBe('user-meta');
      expect(result.agentId).toBe(7);
      expect(result.requirementId).toBe(70);
      expect(result).not.toHaveProperty('credentials');
    });

    it('should return null for non-existent consent ID', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await encryptedVault.getMetadata(999);

      expect(result).toBeNull();
    });
  });

  describe('encryptedVault.size', () => {
    it('should return count of active credentials', async () => {
      mockExecute.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await encryptedVault.size();

      expect(result).toBe(5);
    });

    it('should return 0 on database error', async () => {
      mockExecute.mockRejectedValue(new Error('Count failed'));

      const result = await encryptedVault.size();

      expect(result).toBe(0);
    });
  });

  describe('encryptedVault.clear', () => {
    it('should clear all credentials', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await encryptedVault.clear();

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Clear failed'));

      await expect(encryptedVault.clear()).resolves.not.toThrow();
    });
  });

  describe('encryptedVault.warmCache', () => {
    it('should load credentials into memory cache', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      const credentials = { key: 'cached' };
      const encryptedData = encrypt(JSON.stringify(credentials));

      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [
            {
              consent_id: 1,
              encrypted_data: encryptedData,
              user_id: 'user-warm',
              agent_id: 1,
              requirement_id: 1,
              expires_at: futureDate.toISOString(),
              encrypted_at: new Date().toISOString(),
            },
          ],
        });

      await encryptedVault.warmCache();

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockRejectedValueOnce(new Error('Warm cache failed'));

      await expect(encryptedVault.warmCache()).resolves.not.toThrow();
    });
  });

  describe('encryption key derivation', () => {
    it('should use CREDENTIAL_ENCRYPTION_KEY when available', async () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'custom-key-1';
      vi.resetModules();
      const module1 = await import('../encryptedVault');

      const plaintext = 'test-data';
      const encrypted = module1.encrypt(plaintext);
      const decrypted = module1.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fall back to SESSION_SECRET when CREDENTIAL_ENCRYPTION_KEY not set', async () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      process.env.SESSION_SECRET = 'fallback-secret';
      vi.resetModules();
      const module = await import('../encryptedVault');

      const plaintext = 'test-fallback';
      const encrypted = module.encrypt(plaintext);
      const decrypted = module.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext with different keys', async () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'key-a';
      vi.resetModules();
      const module1 = await import('../encryptedVault');
      const encrypted1 = module1.encrypt('same-data');

      process.env.CREDENTIAL_ENCRYPTION_KEY = 'key-b';
      vi.resetModules();
      const module2 = await import('../encryptedVault');
      const encrypted2 = module2.encrypt('same-data');

      // Parse and compare the actual encrypted data (not just the wrapper)
      const data1 = JSON.parse(Buffer.from(encrypted1, 'base64').toString('utf8'));
      const data2 = JSON.parse(Buffer.from(encrypted2, 'base64').toString('utf8'));

      expect(data1.data).not.toBe(data2.data);
    });

    it('should not decrypt with wrong key', async () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'correct-key';
      vi.resetModules();
      const module1 = await import('../encryptedVault');
      const encrypted = module1.encrypt('secret');

      process.env.CREDENTIAL_ENCRYPTION_KEY = 'wrong-key';
      vi.resetModules();
      const module2 = await import('../encryptedVault');

      expect(() => module2.decrypt(encrypted)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent set operations', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const data = {
        credentials: { key: 'concurrent' },
        expiresAt: new Date(Date.now() + 3600000),
        userId: 'user-concurrent',
        agentId: 1,
        requirementId: 1,
        encryptedAt: new Date(),
      };

      await Promise.all([
        encryptedVault.set(1, data),
        encryptedVault.set(2, data),
        encryptedVault.set(3, data),
      ]);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle credentials with nested objects', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      const credentials = {
        apiKey: 'key',
        oauth: {
          accessToken: 'access',
          refreshToken: 'refresh',
          scopes: ['read', 'write'],
        },
        metadata: {
          created: new Date().toISOString(),
          tags: ['production', 'v2'],
        },
      };
      const encryptedData = encrypt(JSON.stringify(credentials));

      mockExecute
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 1
        .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX 2
        .mockResolvedValueOnce({
          rows: [{
            encrypted_data: encryptedData,
            user_id: 'user-nested',
            agent_id: 1,
            requirement_id: 1,
            expires_at: futureDate.toISOString(),
            encrypted_at: new Date().toISOString(),
          }],
        });

      const result = await encryptedVault.get(1);

      expect(result.credentials).toEqual(credentials);
    });
  });
});
