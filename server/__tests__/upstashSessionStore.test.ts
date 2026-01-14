/**
 * Tests for Upstash Redis session store
 * Mocks the upstashRedis module to avoid real API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpstashSessionStore } from '../upstashSessionStore';

// Mock the upstashRedis module
const mockClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
  mget: vi.fn(),
  expire: vi.fn(),
};

vi.mock('../upstashRedis', () => ({
  upstashRedis: {
    isAvailable: vi.fn().mockReturnValue(true),
    getClient: vi.fn().mockReturnValue(mockClient),
    delete: vi.fn(),
    deleteByPattern: vi.fn(),
    expire: vi.fn(),
  },
}));

import { upstashRedis } from '../upstashRedis';

describe('UpstashSessionStore', () => {
  let store: UpstashSessionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new UpstashSessionStore({
      prefix: 'test-sess:',
      ttl: 3600,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when upstash redis is available', () => {
      expect(UpstashSessionStore.isAvailable()).toBe(true);
    });

    it('should return false when upstash redis is not available', () => {
      vi.mocked(upstashRedis.isAvailable).mockReturnValueOnce(false);
      expect(UpstashSessionStore.isAvailable()).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve session data', (done) => {
      const mockSession = { cookie: { maxAge: 3600000 }, user: { id: '123' } };
      mockClient.get.mockResolvedValue(mockSession);

      store.get('test-sid', (err, session) => {
        expect(err).toBeNull();
        expect(session).toEqual(mockSession);
        expect(mockClient.get).toHaveBeenCalledWith('test-sess:test-sid');
        done();
      });
    });

    it('should return null when session does not exist', (done) => {
      mockClient.get.mockResolvedValue(null);

      store.get('nonexistent-sid', (err, session) => {
        expect(err).toBeNull();
        expect(session).toBeNull();
        done();
      });
    });

    it('should handle errors', (done) => {
      mockClient.get.mockRejectedValue(new Error('Redis error'));

      store.get('error-sid', (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Redis error');
        done();
      });
    });
  });

  describe('set', () => {
    it('should store session data with TTL from cookie', (done) => {
      mockClient.set.mockResolvedValue('OK');
      const session = { cookie: { maxAge: 7200000 }, user: { id: '123' } } as Express.SessionData;

      store.set('test-sid', session, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.set).toHaveBeenCalledWith(
          'test-sess:test-sid',
          session,
          { ex: 7200 } // maxAge / 1000
        );
        done();
      });
    });

    it('should use default TTL when cookie has no maxAge', (done) => {
      mockClient.set.mockResolvedValue('OK');
      const session = { cookie: {} } as Express.SessionData;

      store.set('test-sid', session, (err) => {
        expect(err).toBeUndefined();
        expect(mockClient.set).toHaveBeenCalledWith(
          'test-sess:test-sid',
          session,
          { ex: 3600 } // default ttl from store config
        );
        done();
      });
    });

    it('should handle errors', (done) => {
      mockClient.set.mockRejectedValue(new Error('Write error'));
      const session = { cookie: {} } as Express.SessionData;

      store.set('error-sid', session, (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Write error');
        done();
      });
    });

    it('should handle missing client', (done) => {
      vi.mocked(upstashRedis.getClient).mockReturnValueOnce(null);
      const session = { cookie: {} } as Express.SessionData;

      store.set('test-sid', session, (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Upstash Redis client not available');
        done();
      });
    });
  });

  describe('destroy', () => {
    it('should delete session', (done) => {
      vi.mocked(upstashRedis.delete).mockResolvedValue(true);

      store.destroy('test-sid', (err) => {
        expect(err).toBeUndefined();
        expect(upstashRedis.delete).toHaveBeenCalledWith('test-sess:test-sid');
        done();
      });
    });

    it('should handle errors', (done) => {
      vi.mocked(upstashRedis.delete).mockRejectedValue(new Error('Delete error'));

      store.destroy('error-sid', (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Delete error');
        done();
      });
    });
  });

  describe('touch', () => {
    it('should refresh session TTL', (done) => {
      vi.mocked(upstashRedis.expire).mockResolvedValue(true);
      const session = { cookie: { maxAge: 3600000 } } as Express.SessionData;

      store.touch('test-sid', session, (err) => {
        expect(err).toBeUndefined();
        expect(upstashRedis.expire).toHaveBeenCalledWith('test-sess:test-sid', 3600);
        done();
      });
    });

    it('should handle errors', (done) => {
      vi.mocked(upstashRedis.expire).mockRejectedValue(new Error('Expire error'));
      const session = { cookie: {} } as Express.SessionData;

      store.touch('error-sid', session, (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Expire error');
        done();
      });
    });
  });

  describe('all', () => {
    it('should retrieve all sessions', (done) => {
      mockClient.scan.mockResolvedValue([0, ['test-sess:sid1', 'test-sess:sid2']]);
      mockClient.mget.mockResolvedValue([
        { user: { id: '1' } },
        { user: { id: '2' } },
      ]);

      store.all((err, sessions) => {
        expect(err).toBeNull();
        expect(sessions).toEqual({
          sid1: { user: { id: '1' } },
          sid2: { user: { id: '2' } },
        });
        done();
      });
    });

    it('should handle pagination', (done) => {
      mockClient.scan
        .mockResolvedValueOnce([100, ['test-sess:sid1']])
        .mockResolvedValueOnce([0, ['test-sess:sid2']]);
      mockClient.mget
        .mockResolvedValueOnce([{ user: { id: '1' } }])
        .mockResolvedValueOnce([{ user: { id: '2' } }]);

      store.all((err, sessions) => {
        expect(err).toBeNull();
        expect(sessions).toEqual({
          sid1: { user: { id: '1' } },
          sid2: { user: { id: '2' } },
        });
        expect(mockClient.scan).toHaveBeenCalledTimes(2);
        done();
      });
    });

    it('should return empty object when client not available', (done) => {
      vi.mocked(upstashRedis.getClient).mockReturnValueOnce(null);

      store.all((err, sessions) => {
        expect(err).toBeNull();
        expect(sessions).toEqual({});
        done();
      });
    });
  });

  describe('length', () => {
    it('should return session count', (done) => {
      mockClient.scan.mockResolvedValue([0, ['key1', 'key2', 'key3']]);

      store.length((err, length) => {
        expect(err).toBeNull();
        expect(length).toBe(3);
        done();
      });
    });

    it('should handle pagination', (done) => {
      mockClient.scan
        .mockResolvedValueOnce([100, ['key1', 'key2']])
        .mockResolvedValueOnce([0, ['key3']]);

      store.length((err, length) => {
        expect(err).toBeNull();
        expect(length).toBe(3);
        done();
      });
    });

    it('should return 0 when client not available', (done) => {
      vi.mocked(upstashRedis.getClient).mockReturnValueOnce(null);

      store.length((err, length) => {
        expect(err).toBeNull();
        expect(length).toBe(0);
        done();
      });
    });
  });

  describe('clear', () => {
    it('should clear all sessions', (done) => {
      vi.mocked(upstashRedis.deleteByPattern).mockResolvedValue(5);

      store.clear((err) => {
        expect(err).toBeUndefined();
        expect(upstashRedis.deleteByPattern).toHaveBeenCalledWith('test-sess:*');
        done();
      });
    });

    it('should handle errors', (done) => {
      vi.mocked(upstashRedis.deleteByPattern).mockRejectedValue(new Error('Clear error'));

      store.clear((err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Clear error');
        done();
      });
    });
  });

  describe('constructor', () => {
    it('should use default prefix and TTL', () => {
      const defaultStore = new UpstashSessionStore();
      expect((defaultStore as any).prefix).toBe('sess:');
      expect((defaultStore as any).ttl).toBe(7 * 24 * 60 * 60); // 1 week
    });

    it('should use custom prefix and TTL', () => {
      const customStore = new UpstashSessionStore({
        prefix: 'custom:',
        ttl: 86400,
      });
      expect((customStore as any).prefix).toBe('custom:');
      expect((customStore as any).ttl).toBe(86400);
    });
  });
});
