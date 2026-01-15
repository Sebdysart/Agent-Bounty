/**
 * Tests for Cursor-based Pagination Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  normalizePaginationParams,
  createPaginatedResult,
  PaginationParams,
} from '../pagination';

describe('Pagination Utilities', () => {
  describe('encodeCursor', () => {
    it('should encode a cursor from createdAt and id', () => {
      const createdAt = new Date('2024-01-15T12:00:00Z');
      const id = 123;
      const cursor = encodeCursor(createdAt, id);

      expect(cursor).toBeTruthy();
      expect(typeof cursor).toBe('string');
    });

    it('should create different cursors for different inputs', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const cursor1 = encodeCursor(date, 123);
      const cursor2 = encodeCursor(date, 456);
      const cursor3 = encodeCursor(new Date('2024-01-16T12:00:00Z'), 123);

      expect(cursor1).not.toBe(cursor2);
      expect(cursor1).not.toBe(cursor3);
    });
  });

  describe('decodeCursor', () => {
    it('should decode a valid cursor', () => {
      const createdAt = new Date('2024-01-15T12:00:00Z');
      const id = 123;
      const cursor = encodeCursor(createdAt, id);

      const decoded = decodeCursor(cursor);

      expect(decoded).not.toBeNull();
      expect(decoded!.id).toBe(id);
      expect(decoded!.createdAt.toISOString()).toBe(createdAt.toISOString());
    });

    it('should return null for invalid cursor', () => {
      expect(decodeCursor('invalid-cursor')).toBeNull();
      expect(decodeCursor('')).toBeNull();
      expect(decodeCursor('not-base64!')).toBeNull();
    });

    it('should return null for malformed JSON in cursor', () => {
      const invalidJson = Buffer.from('not-json').toString('base64url');
      expect(decodeCursor(invalidJson)).toBeNull();
    });

    it('should return null for cursor missing required fields', () => {
      const missingId = Buffer.from(JSON.stringify({ createdAt: '2024-01-15' })).toString('base64url');
      const missingDate = Buffer.from(JSON.stringify({ id: 123 })).toString('base64url');

      expect(decodeCursor(missingId)).toBeNull();
      expect(decodeCursor(missingDate)).toBeNull();
    });
  });

  describe('normalizePaginationParams', () => {
    it('should use default limit when not provided', () => {
      const result = normalizePaginationParams({});

      expect(result.limit).toBe(20);
      expect(result.cursor).toBeNull();
    });

    it('should respect provided limit within bounds', () => {
      const result = normalizePaginationParams({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it('should cap limit at maximum', () => {
      const result = normalizePaginationParams({ limit: 500 });
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = normalizePaginationParams({ limit: 0 });
      expect(result.limit).toBe(1);

      const resultNegative = normalizePaginationParams({ limit: -10 });
      expect(resultNegative.limit).toBe(1);
    });

    it('should decode valid cursor', () => {
      const createdAt = new Date('2024-01-15T12:00:00Z');
      const cursor = encodeCursor(createdAt, 123);

      const result = normalizePaginationParams({ cursor });

      expect(result.cursor).not.toBeNull();
      expect(result.cursor!.id).toBe(123);
    });

    it('should return null cursor for invalid cursor string', () => {
      const result = normalizePaginationParams({ cursor: 'invalid' });
      expect(result.cursor).toBeNull();
    });
  });

  describe('createPaginatedResult', () => {
    const createTestData = (count: number, startId: number = 1): Array<{ createdAt: Date; id: number; name: string }> => {
      const data = [];
      const baseDate = new Date('2024-01-15T12:00:00Z');
      for (let i = 0; i < count; i++) {
        const date = new Date(baseDate.getTime() - i * 1000); // Each item 1 second older
        data.push({
          id: startId + i,
          createdAt: date,
          name: `Item ${startId + i}`,
        });
      }
      return data;
    };

    it('should return hasMore false when data length <= limit', () => {
      const data = createTestData(5);
      const result = createPaginatedResult(data, 10);

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.data.length).toBe(5);
    });

    it('should return hasMore true when data length > limit', () => {
      const data = createTestData(11); // 11 items, limit 10
      const result = createPaginatedResult(data, 10);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.data.length).toBe(10);
    });

    it('should set nextCursor based on last returned item', () => {
      const data = createTestData(11, 100);
      const result = createPaginatedResult(data, 10);

      expect(result.nextCursor).not.toBeNull();

      const decoded = decodeCursor(result.nextCursor!);
      expect(decoded).not.toBeNull();
      // Last item should be id 109 (100 + 9, 0-indexed from 0-9)
      expect(decoded!.id).toBe(109);
    });

    it('should handle empty data array', () => {
      const result = createPaginatedResult([], 10);

      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle exact limit match', () => {
      const data = createTestData(10);
      const result = createPaginatedResult(data, 10);

      expect(result.hasMore).toBe(false);
      expect(result.data.length).toBe(10);
    });
  });

  describe('pagination flow integration', () => {
    it('should support paginating through multiple pages', () => {
      // Simulate fetching 3 pages of data
      const createTestData = (count: number, startId: number): Array<{ createdAt: Date; id: number }> => {
        const data = [];
        const baseDate = new Date('2024-01-15T12:00:00Z');
        for (let i = 0; i < count; i++) {
          data.push({
            id: startId - i,
            createdAt: new Date(baseDate.getTime() - (startId - i) * 1000),
          });
        }
        return data;
      };

      // First page (items 100-91)
      const page1Data = createTestData(11, 100); // 11 items to detect hasMore
      const page1 = createPaginatedResult(page1Data, 10);

      expect(page1.data.length).toBe(10);
      expect(page1.hasMore).toBe(true);
      expect(page1.data[0].id).toBe(100);
      expect(page1.data[9].id).toBe(91);

      // Second page would start after item 91
      const page2Cursor = decodeCursor(page1.nextCursor!);
      expect(page2Cursor).not.toBeNull();
      expect(page2Cursor!.id).toBe(91);
    });
  });
});
