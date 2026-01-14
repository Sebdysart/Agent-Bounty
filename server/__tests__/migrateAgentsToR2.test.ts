/**
 * Tests for migrateAgentsToR2 migration script
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const { mockR2Storage, mockAgentCodeService, mockDbSelect, mockDbFrom, mockDbWhere } = vi.hoisted(() => ({
  mockR2Storage: {
    isAvailable: vi.fn(),
  },
  mockAgentCodeService: {
    migrateToR2: vi.fn(),
  },
  mockDbSelect: vi.fn(),
  mockDbFrom: vi.fn(),
  mockDbWhere: vi.fn(),
}));

vi.mock('../r2Storage', () => ({
  r2Storage: mockR2Storage,
}));

vi.mock('../agentCodeService', () => ({
  agentCodeService: mockAgentCodeService,
}));

vi.mock('../db', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('drizzle-orm', () => ({
  isNull: vi.fn((col: any) => ({ col, _type: 'isNull' })),
  eq: vi.fn((col: any, val: any) => ({ col, val, _type: 'eq' })),
}));

vi.mock('@shared/schema', () => ({
  agentUploads: {
    id: 'id',
    name: 'name',
    uploadType: 'upload_type',
    configJson: 'config_json',
    prompt: 'prompt',
    r2CodeKey: 'r2_code_key',
  },
}));

// Import after mocks
import { migrateAgentsToR2 } from '../../script/migrateAgentsToR2';

describe('migrateAgentsToR2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockReturnValue({ from: mockDbFrom });
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return early if R2 is not available', async () => {
    mockR2Storage.isAvailable.mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(0);
    expect(result.migrated).toBe(0);
    expect(mockDbSelect).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should skip agents without code', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Test Agent', uploadType: 'full_code', configJson: null, prompt: null, r2CodeKey: null },
    ]);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.migrated).toBe(0);
    expect(mockAgentCodeService.migrateToR2).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should skip non-full_code agents', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Test Agent', uploadType: 'no_code', configJson: 'some code', prompt: null, r2CodeKey: null },
    ]);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.migrated).toBe(0);
    expect(mockAgentCodeService.migrateToR2).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should migrate full_code agents with configJson', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Test Agent', uploadType: 'full_code', configJson: 'console.log("test")', prompt: null, r2CodeKey: null },
    ]);
    mockAgentCodeService.migrateToR2.mockResolvedValue(true);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(1);
    expect(result.migrated).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockAgentCodeService.migrateToR2).toHaveBeenCalledWith(1);
    consoleSpy.mockRestore();
  });

  it('should handle migration failures', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Test Agent', uploadType: 'full_code', configJson: 'code', prompt: null, r2CodeKey: null },
    ]);
    mockAgentCodeService.migrateToR2.mockResolvedValue(false);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(1);
    expect(result.migrated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe(1);
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle migration exceptions', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Test Agent', uploadType: 'full_code', configJson: 'code', prompt: null, r2CodeKey: null },
    ]);
    mockAgentCodeService.migrateToR2.mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(1);
    expect(result.migrated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toBe('Network error');
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should not make changes in dry-run mode', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Test Agent', uploadType: 'full_code', configJson: 'code', prompt: null, r2CodeKey: null },
    ]);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await migrateAgentsToR2(true);

    expect(result.total).toBe(1);
    expect(result.migrated).toBe(1);
    expect(mockAgentCodeService.migrateToR2).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should migrate multiple agents', async () => {
    mockR2Storage.isAvailable.mockReturnValue(true);
    mockDbWhere.mockResolvedValue([
      { id: 1, name: 'Agent 1', uploadType: 'full_code', configJson: 'code1', prompt: null, r2CodeKey: null },
      { id: 2, name: 'Agent 2', uploadType: 'no_code', configJson: null, prompt: 'prompt', r2CodeKey: null },
      { id: 3, name: 'Agent 3', uploadType: 'full_code', configJson: 'code3', prompt: null, r2CodeKey: null },
      { id: 4, name: 'Agent 4', uploadType: 'full_code', configJson: null, prompt: null, r2CodeKey: null },
    ]);
    mockAgentCodeService.migrateToR2.mockResolvedValue(true);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await migrateAgentsToR2(false);

    expect(result.total).toBe(4);
    expect(result.migrated).toBe(2); // Agent 1 and 3
    expect(result.skipped).toBe(2); // Agent 2 (no_code) and 4 (no code)
    expect(mockAgentCodeService.migrateToR2).toHaveBeenCalledTimes(2);
    expect(mockAgentCodeService.migrateToR2).toHaveBeenCalledWith(1);
    expect(mockAgentCodeService.migrateToR2).toHaveBeenCalledWith(3);
    consoleSpy.mockRestore();
  });
});
