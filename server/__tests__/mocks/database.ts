/**
 * Mock Drizzle database for testing
 */

import { vi } from 'vitest';

// Mock query results storage
let mockResults: Record<string, any[]> = {};

export const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockResults.select || [])),
        })),
        limit: vi.fn(() => Promise.resolve(mockResults.select || [])),
      })),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(mockResults.select || [])),
      })),
      limit: vi.fn(() => Promise.resolve(mockResults.select || [])),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(mockResults.select || [])),
        })),
      })),
    })),
  })),

  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve(mockResults.insert || [{ id: 1 }])),
      onConflict: vi.fn(() => ({
        doUpdate: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(mockResults.insert || [{ id: 1 }])),
        })),
      })),
    })),
  })),

  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(mockResults.update || [{ id: 1 }])),
      })),
    })),
  })),

  delete: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  })),

  execute: vi.fn(() => Promise.resolve({ rows: mockResults.execute || [] })),
};

// Utility to set mock results for specific operations
export const setMockResults = (operation: string, results: any[]) => {
  mockResults[operation] = results;
};

// Utility to clear all mock results
export const clearMockResults = () => {
  mockResults = {};
};

// Utility to reset all mocks
export const resetDbMocks = () => {
  clearMockResults();
  vi.clearAllMocks();
};

// Mock the db module
vi.mock('../../db', () => ({
  db: mockDb,
}));

export default mockDb;
