/**
 * Tests for R2 Migration utility
 * Mocks both the R2 storage client and database operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock functions that can be used in vi.mock factories
const {
  mockIsAvailable,
  mockUploadAgentCode,
  mockExists,
  mockDelete,
  mockIsEnabled,
  mockDbSelect,
  mockDbUpdate,
} = vi.hoisted(() => ({
  mockIsAvailable: vi.fn(),
  mockUploadAgentCode: vi.fn(),
  mockExists: vi.fn(),
  mockDelete: vi.fn(),
  mockIsEnabled: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

// Mock r2Storage
vi.mock('../r2Storage', () => ({
  r2Storage: {
    isAvailable: mockIsAvailable,
    uploadAgentCode: mockUploadAgentCode,
    exists: mockExists,
    delete: mockDelete,
  },
}));

// Mock featureFlags
vi.mock('../featureFlags', () => ({
  featureFlags: {
    isEnabled: mockIsEnabled,
  },
}));

// Mock database
vi.mock('../db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
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

// Import after mocks are set up
import { R2MigrationService } from '../r2Migration';

describe('R2MigrationService', () => {
  let service: R2MigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new R2MigrationService();

    // Default mocks
    mockIsEnabled.mockReturnValue(false);
    mockIsAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('canMigrate', () => {
    it('should return false when feature flag is not enabled', () => {
      mockIsEnabled.mockReturnValue(false);
      mockIsAvailable.mockReturnValue(true);

      const result = service.canMigrate();

      expect(result.canMigrate).toBe(false);
      expect(result.reason).toBe('USE_R2_STORAGE feature flag is not enabled');
    });

    it('should return false when R2 storage is not configured', () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(false);

      const result = service.canMigrate();

      expect(result.canMigrate).toBe(false);
      expect(result.reason).toBe('R2 storage is not configured');
    });

    it('should return true when both flag is enabled and R2 is available', () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);

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
      mockIsEnabled.mockReturnValue(false);

      const count = await service.getPendingMigrationCount();

      expect(count).toBe(0);
    });

    it('should return count of pending agents', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ]),
      });

      mockDbSelect.mockReturnValue({
        from: mockFrom,
      });

      const count = await service.getPendingMigrationCount();

      expect(count).toBe(3);
    });
  });

  describe('migrateAgent', () => {
    it('should return error when migration is not possible', async () => {
      mockIsEnabled.mockReturnValue(false);

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('USE_R2_STORAGE feature flag is not enabled');
    });

    it('should return error when agent not found', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      mockDbSelect.mockReturnValue({
        from: mockFrom,
      });

      const result = await service.migrateAgent(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent upload not found');
    });

    it('should return success when agent is already migrated', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 1, r2CodeKey: 'agents/1/source.js', configJson: '{}' },
        ]),
      });

      mockDbSelect.mockReturnValue({
        from: mockFrom,
      });

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(true);
      expect(mockUploadAgentCode).not.toHaveBeenCalled();
    });

    it('should migrate agent with code in configJson', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);
      mockUploadAgentCode.mockResolvedValue({
        success: true,
        key: 'agents/1/source.js',
      });

      const mockWhere = vi.fn();
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere.mockResolvedValue([{ id: 1 }]),
      });

      mockDbSelect.mockReturnValue({
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

      mockDbUpdate.mockReturnValue({
        set: mockSet,
      });

      const result = await service.migrateAgent(1);

      expect(result.success).toBe(true);
      expect(mockUploadAgentCode).toHaveBeenCalledWith('1', 'console.log("hello")');
    });

    it('should handle upload failure', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);
      mockUploadAgentCode.mockResolvedValue({
        success: false,
        key: 'agents/1/source.js',
        error: 'Upload failed',
      });

      mockDbSelect.mockReturnValue({
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
      mockIsEnabled.mockReturnValue(false);

      const result = await service.migrateAll();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('feature flag is not enabled');
    });

    it('should migrate all pending agents', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockIsAvailable.mockReturnValue(true);
      mockUploadAgentCode.mockResolvedValue({
        success: true,
        key: 'agents/1/source.js',
      });

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => ({
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
      mockDbUpdate.mockReturnValue({
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
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.verifyMigration(999);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Agent not found');
    });

    it('should return not migrated when agent has no R2 key', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, r2CodeKey: null }]),
        }),
      });

      const result = await service.verifyMigration(1);

      expect(result.verified).toBe(false);
      expect(result.hasR2Key).toBe(false);
    });

    it('should verify R2 file exists', async () => {
      mockExists.mockResolvedValue(true);

      mockDbSelect.mockReturnValue({
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
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.rollbackMigration(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent not found');
    });

    it('should return success when no R2 key to rollback', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1, r2CodeKey: null }]),
        }),
      });

      const result = await service.rollbackMigration(1);

      expect(result.success).toBe(true);
    });

    it('should delete R2 file and clear key', async () => {
      mockIsAvailable.mockReturnValue(true);
      mockDelete.mockResolvedValue(true);

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 1, r2CodeKey: 'agents/1/source.js' },
          ]),
        }),
      });

      const mockWhere = vi.fn().mockResolvedValue([{ id: 1 }]);
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      });

      const result = await service.rollbackMigration(1);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('agents/1/source.js');
    });
  });

  describe('getStatistics', () => {
    it('should return migration statistics', async () => {
      // Mock returns a sequence of results for each DB call
      // The function makes 5 db.select() calls:
      // 1. totalResult (with from - returns array to destructure)
      // 2. migratedAgents (with from.where)
      // 3. pendingAgents (with from.where)
      // 4. withoutCodeAgents (with from.where)
      // 5. allAgents (with from only)
      let callIndex = 0;
      mockDbSelect.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          callIndex++;
          const mockData = {
            1: [{ count: 100 }], // totalResult
            2: [{ id: 1 }, { id: 2 }], // migrated
            3: [{ id: 3 }, { id: 4 }, { id: 5 }], // pending
            4: [{ id: 6 }], // without code
            5: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }], // all
          };
          const result = mockData[callIndex as keyof typeof mockData] || [];

          // Some calls don't use .where()
          if (callIndex === 1 || callIndex === 5) {
            return Promise.resolve(result);
          }
          // Others use .where()
          return {
            where: vi.fn().mockResolvedValue(result),
          };
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
      mockExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      mockDbSelect.mockReturnValue({
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
