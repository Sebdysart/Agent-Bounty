/**
 * Tests for AgentCodeService - handles agent code storage via R2
 * Mocks R2 storage and database operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock that can be used in vi.mock factories
const { mockR2Storage } = vi.hoisted(() => ({
  mockR2Storage: {
    isAvailable: vi.fn(),
    uploadAgentCode: vi.fn(),
    downloadAgentCode: vi.fn(),
    deleteAgentCode: vi.fn(),
  },
}));

vi.mock('../r2Storage', () => ({
  r2Storage: mockR2Storage,
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: any, val: any) => ({ col, val, _type: 'eq' })),
}));

// Mock database operations
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbSet = vi.fn();
const mockDbReturning = vi.fn();

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: mockDbFrom,
    }),
    update: () => ({
      set: mockDbSet,
    }),
  },
}));

// Mock schema
vi.mock('@shared/schema', () => ({
  agentUploads: {
    id: 'id',
    r2CodeKey: 'r2_code_key',
    configJson: 'config_json',
    prompt: 'prompt',
    uploadType: 'upload_type',
  },
}));

// Import after mocks are set up
import { agentCodeService } from '../agentCodeService';

describe('AgentCodeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chains
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockResolvedValue([]);
    mockDbSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockDbReturning }) });
    mockDbReturning.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('storeCode', () => {
    it('should store code in R2 when available', async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.uploadAgentCode.mockResolvedValue({ success: true, key: 'agents/123/source.js' });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Re-setup the db mock for update chain
      const { db } = await import('../db');
      (db as any).update = mockUpdate;

      const result = await agentCodeService.storeCode(123, 'console.log("test")');

      expect(result.success).toBe(true);
      expect(result.r2CodeKey).toBe('agent-uploads/123/source.js');
      expect(mockR2Storage.uploadAgentCode).toHaveBeenCalledWith('123', 'console.log("test")');
    });

    it('should return success with warning when R2 not available', async () => {
      mockR2Storage.isAvailable.mockReturnValue(false);

      const result = await agentCodeService.storeCode(123, 'code');

      expect(result.success).toBe(true);
      expect(result.error).toBe('R2 not configured, code stored in database');
      expect(mockR2Storage.uploadAgentCode).not.toHaveBeenCalled();
    });

    it('should return error when R2 upload fails', async () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.uploadAgentCode.mockResolvedValue({ success: false, error: 'Upload failed' });

      const result = await agentCodeService.storeCode(123, 'code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });
  });

  describe('getCode', () => {
    it('should get code from R2 when r2CodeKey exists', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: 'agents/123/source.js',
        configJson: 'db-code',
        prompt: null,
        uploadType: 'full_code',
      }]);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.downloadAgentCode.mockResolvedValue('r2-code');

      const result = await agentCodeService.getCode(123);

      expect(result.success).toBe(true);
      expect(result.code).toBe('r2-code');
      expect(result.source).toBe('r2');
    });

    it('should fall back to DB when R2 download fails', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: 'agents/123/source.js',
        configJson: 'db-code',
        prompt: null,
        uploadType: 'full_code',
      }]);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.downloadAgentCode.mockResolvedValue(null);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await agentCodeService.getCode(123);

      expect(result.success).toBe(true);
      expect(result.code).toBe('db-code');
      expect(result.source).toBe('db');
      consoleSpy.mockRestore();
    });

    it('should get code from DB when no r2CodeKey', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: null,
        configJson: 'db-code',
        prompt: null,
        uploadType: 'full_code',
      }]);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const result = await agentCodeService.getCode(123);

      expect(result.success).toBe(true);
      expect(result.code).toBe('db-code');
      expect(result.source).toBe('db');
      expect(mockR2Storage.downloadAgentCode).not.toHaveBeenCalled();
    });

    it('should use prompt as fallback when configJson is empty', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: null,
        configJson: null,
        prompt: 'prompt-code',
        uploadType: 'no_code',
      }]);

      const result = await agentCodeService.getCode(123);

      expect(result.success).toBe(true);
      expect(result.code).toBe('prompt-code');
      expect(result.source).toBe('db');
    });

    it('should return error when agent not found', async () => {
      mockDbWhere.mockResolvedValue([]);

      const result = await agentCodeService.getCode(999);

      expect(result.success).toBe(false);
      expect(result.source).toBe('none');
      expect(result.error).toBe('Agent upload not found');
    });

    it('should return error when no code found', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: null,
        configJson: null,
        prompt: null,
        uploadType: 'full_code',
      }]);

      const result = await agentCodeService.getCode(123);

      expect(result.success).toBe(false);
      expect(result.source).toBe('none');
      expect(result.error).toBe('No code found for agent');
    });
  });

  describe('deleteCode', () => {
    it('should delete code from R2', async () => {
      mockDbWhere.mockResolvedValue([{ r2CodeKey: 'agents/123/source.js' }]);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.deleteAgentCode.mockResolvedValue(true);

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      const { db } = await import('../db');
      (db as any).update = mockUpdate;

      const result = await agentCodeService.deleteCode(123);

      expect(result).toBe(true);
      expect(mockR2Storage.deleteAgentCode).toHaveBeenCalledWith('123');
    });

    it('should return true when R2 not available', async () => {
      mockR2Storage.isAvailable.mockReturnValue(false);

      const result = await agentCodeService.deleteCode(123);

      expect(result).toBe(true);
      expect(mockR2Storage.deleteAgentCode).not.toHaveBeenCalled();
    });

    it('should return true when no r2CodeKey exists', async () => {
      mockDbWhere.mockResolvedValue([{ r2CodeKey: null }]);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const result = await agentCodeService.deleteCode(123);

      expect(result).toBe(true);
      expect(mockR2Storage.deleteAgentCode).not.toHaveBeenCalled();
    });
  });

  describe('migrateToR2', () => {
    it('should migrate full_code agent to R2', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: null,
        configJson: 'code-to-migrate',
        prompt: null,
        uploadType: 'full_code',
      }]);
      mockR2Storage.isAvailable.mockReturnValue(true);
      mockR2Storage.uploadAgentCode.mockResolvedValue({ success: true, key: 'agents/123/source.js' });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      const { db } = await import('../db');
      (db as any).update = mockUpdate;

      const result = await agentCodeService.migrateToR2(123);

      expect(result).toBe(true);
      expect(mockR2Storage.uploadAgentCode).toHaveBeenCalled();
    });

    it('should skip migration for non-full_code agents', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: null,
        configJson: 'config',
        prompt: null,
        uploadType: 'no_code',
      }]);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const result = await agentCodeService.migrateToR2(123);

      expect(result).toBe(true);
      expect(mockR2Storage.uploadAgentCode).not.toHaveBeenCalled();
    });

    it('should skip migration when already in R2', async () => {
      mockDbWhere.mockResolvedValue([{
        r2CodeKey: 'agents/123/source.js',
        configJson: 'code',
        prompt: null,
        uploadType: 'full_code',
      }]);
      mockR2Storage.isAvailable.mockReturnValue(true);

      const result = await agentCodeService.migrateToR2(123);

      expect(result).toBe(true);
      expect(mockR2Storage.uploadAgentCode).not.toHaveBeenCalled();
    });

    it('should return false when R2 not available', async () => {
      mockR2Storage.isAvailable.mockReturnValue(false);

      const result = await agentCodeService.migrateToR2(123);

      expect(result).toBe(false);
    });
  });

  describe('isR2Available', () => {
    it('should return R2 availability status', () => {
      mockR2Storage.isAvailable.mockReturnValue(true);
      expect(agentCodeService.isR2Available()).toBe(true);

      mockR2Storage.isAvailable.mockReturnValue(false);
      expect(agentCodeService.isR2Available()).toBe(false);
    });
  });
});
