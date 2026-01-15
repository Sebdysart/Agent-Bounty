/**
 * Tests for R2 Migration utility
 * Mocks both the R2 storage client and database operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { R2MigrationService } from '../r2Migration';

// Mock r2Storage
const mockR2Storage = {
  isAvailable: vi.fn(),
  uploadAgentCode: vi.fn(),
  exists: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../r2Storage', () => ({
  r2Storage: mockR2Storage,
}));

// Mock featureFlags
const mockFeatureFlags = {
  isEnabled: vi.fn(),
};

vi.mock('../featureFlags', () => ({
  featureFlags: mockFeatureFlags,
}));

// Mock database
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
};

vi.mock('../db', () => ({
  db: mockDb,
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  isNull: vi.fn((a) => ({ isNull: a })),
  isNotNull: vi.fn((a) => ({ isNotNull: a })),
  and: vi.fn((...args) => ({ and: args })),
}));

// Mock schema
vi.mock('@shared/schema', () => ({
  agentUploads: {
    id: 'id',
    r2CodeKey: 'r2CodeKey',
    configJson: 'configJson',
    updatedAt: 'updatedAt',
  },
  agentVersions: {},
}));

describe('R2MigrationService', () => {
  let service: R2MigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new R2MigrationService();

    // Default mocks
    mockFeatureFlags.isEnabled.mockReturnValue(false);
    mockR2Storage.isAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('canMigrate', () => {
    it('should return false when feature flag is not enabled', () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const result = service.canMigrate();

      expect(result.canMigrate).toBe(false);
      expect(result.reason).toBe('USE_R2_STORAGE feature flag is not enabled');
    });

    it('should return false when R2 storage is not configured', () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(false);

      const result = service.canMigrate();

      expect(result.canMigrate).toBe(false);
      expect(result.reason).toBe('R2 storage is not configured');
    });

    it('should return true when both flag is enabled and R2 is available', () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const result = service.canMigrate();

      expect(result.canMigrate).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('getProgress', () => {
    it('should return initial progress state', () => {
      const progress = service.getProgress();

      expect(progress).toEqual({
        total: 0,
        processed: 0,
        status: 'idle',
      });
    });
  });

  describe('resetProgress', () => {
    it('should reset progress to initial state', () => {
      // Manually set some progress state (simulate internal modification)
      (service as any).progress = {
        total: 10,
        processed: 5,
        status: 'running',
        current: 3,
      };

      service.resetProgress();

      expect(service.getProgress()).toEqual({
        total: 0,
        processed: 0,
        status: 'idle',
      });
    });
  });

  describe('getPendingMigrationCount', () => {
    it('should return 0 when migration is not possible', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);

      const count = await service.getPendingMigrationCount();

      expect(count).toBe(0);
    });

    it('should return count of pending agents', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ]),
      });

      mockDb.select.mockReturnValue({
        from: mockFrom,
      });

      const count = await service.getPendingMigrationCount();

      expect(count).toBe(3);
    });
  });

  describe('migrateAgent', () => {
    it('should return error when migration is not possible', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('USE_R2_STORAGE feature flag is not enabled');
    });

    it('should return error when agent not found', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      mockDb.select.mockReturnValue({
        from: mockFrom,
      });

      const result = await service.migrateAgent(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent upload not found');
    });

    it('should return success when agent is already migrated', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 1, r2CodeKey: 'agents/1/source.js', configJson: '{}' },
        ]),
      });

      mockDb.select.mockReturnValue({
        from: mockFrom,
      });

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(true);
      expect(mockR2Storage.uploadAgentCode).not.toHaveBeenCalled();
    });

    it('should migrate agent with code in configJson', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.uploadAgentCode.mockResolvedValue({
        success: true,
        key: 'agents/1/source.js',
      });

      const mockWhere = vi.fn();
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere.mockResolvedValue([{ id: 1 }]),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              r2CodeKey: null,
              configJson: JSON.stringify({ code: 'console.log("hello")' }),
            },
          ]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: mockSet,
      });

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(true);
      expect(mockR2Storage.uploadAgentCode).toHaveBeenCalledWith('1', 'console.log("hello")');
    });

    it('should handle upload failure', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.uploadAgentCode.mockResolvedValue({
        success: false,
        key: 'agents/1/source.js',
        error: 'Upload failed',
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              r2CodeKey: null,
              configJson: JSON.stringify({ code: 'test code' }),
            },
          ]),
        }),
      });

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });
  });

  describe('migrateAll', () => {
    it('should return error when migration is not possible', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);

      const result = await service.migrateAll();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('Cannot migrate');
    });

    it('should migrate all pending agents', async () => {
      mockFeatureFlags.isEnabled.mockReturnValue(true);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.uploadAgentCode.mockResolvedValue({
        success: true,
        key: 'agents/1/source.js',
      });

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            selectCallCount++;
            // First call is for getting pending agents list
            if (selectCallCount === 1) {
              return Promise.resolve([{ id: 1 }, { id: 2 }]);
            }
            // Subsequent calls are for individual agent lookups
            return Promise.resolve([
              {
                id: selectCallCount - 1,
                r2CodeKey: null,
                configJson: JSON.stringify({ code: 'test' }),
              },
            ]);
          }),
        }),
      }));

      const mockWhere = vi.fn().mockResolvedValue([{ id: 1 }]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      });

      const progressCallback = vi.fn();
      const result = await service.migrateAll({ onProgress: progressCallback });

      expect(result.totalProcessed).toBe(2);
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('verifyMigration', () => {
    it('should return not found when agent does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.verifyMigration(999);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Agent not found');
    });

    it('should return not migrated when agent has no R2 key', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, r2CodeKey: null }]),
        }),
      });

      const result = await service.verifyMigration(1);

      expect(result.verified).toBe(false);
      expect(result.hasR2Key).toBe(false);
    });

    it('should verify R2 file exists', async () => {
      mockR2Storage.exists.mockResolvedValue(true);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 1, r2CodeKey: 'agents/1/source.js' },
          ]),
        }),
      });

      const result = await service.verifyMigration(1);

      expect(result.verified).toBe(true);
      expect(result.hasR2Key).toBe(true);
      expect(result.r2Exists).toBe(true);
    });
  });

  describe('rollbackMigration', () => {
    it('should return error when agent not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.rollbackMigration(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent not found');
    });

    it('should return success when no R2 key to rollback', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, r2CodeKey: null }]),
        }),
      });

      const result = await service.rollbackMigration(1);

      expect(result.success).toBe(true);
    });

    it('should delete R2 file and clear key', async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.delete.mockResolvedValue(true);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 1, r2CodeKey: 'agents/1/source.js' },
          ]),
        }),
      });

      const mockWhere = vi.fn().mockResolvedValue([{ id: 1 }]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      });

      const result = await service.rollbackMigration(1);

      expect(result.success).toBe(true);
      expect(mockR2Storage.delete).toHaveBeenCalledWith('agents/1/source.js');
    });
  });

  describe('getStatistics', () => {
    it('should return migration statistics', async () => {
      const mockSelectResults = [
        [{ count: 100 }], // total
        [{ id: 1 }, { id: 2 }], // migrated (2)
        [{ id: 3 }, { id: 4 }, { id: 5 }], // pending (3)
        [{ id: 6 }], // without code (1)
        // Total agents query
        [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
      ];

      let callIndex = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const result = mockSelectResults[callIndex];
            callIndex++;
            return Promise.resolve(result || []);
          }),
        }),
      }));

      const stats = await service.getStatistics();

      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('migratedToR2');
      expect(stats).toHaveProperty('pendingMigration');
      expect(stats).toHaveProperty('withoutCode');
    });
  });

  describe('verifyAllMigrations', () => {
    it('should verify all migrated agents', async () => {
      mockR2Storage.exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 1, r2CodeKey: 'agents/1/source.js' },
            { id: 2, r2CodeKey: 'agents/2/source.js' },
          ]),
        }),
      });

      const result = await service.verifyAllMigrations();

      expect(result.total).toBe(2);
      expect(result.verified).toBe(1);
      expect(result.missing).toBe(1);
      expect(result.missingIds).toContain(2);
    });
  });
});
