/**
 * Cursor-based pagination utilities for large result sets.
 * Uses encoded cursors based on (createdAt, id) for stable, efficient pagination.
 */

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DecodedCursor {
  createdAt: Date;
  id: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Encodes a cursor from createdAt timestamp and id.
 * Format: base64(JSON({ createdAt: ISO string, id: number }))
 */
export function encodeCursor(createdAt: Date, id: number): string {
  const payload = JSON.stringify({
    createdAt: createdAt.toISOString(),
    id,
  });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decodes a cursor string back to createdAt and id.
 * Returns null if cursor is invalid.
 */
export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(payload);
    if (!parsed.createdAt || typeof parsed.id !== 'number') {
      return null;
    }
    return {
      createdAt: new Date(parsed.createdAt),
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

/**
 * Normalizes pagination params with defaults and limits.
 */
export function normalizePaginationParams(params: PaginationParams): {
  cursor: DecodedCursor | null;
  limit: number;
} {
  const limit = Math.min(
    Math.max(1, params.limit || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  return { cursor, limit };
}

/**
 * Creates a paginated result from a data array.
 * Assumes data is already sorted by (createdAt DESC, id DESC).
 * Fetches limit+1 items to determine hasMore, then returns limit items.
 */
export function createPaginatedResult<T extends { createdAt: Date; id: number }>(
  data: T[],
  limit: number
): PaginatedResult<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
  }

  return {
    data: items,
    nextCursor,
    hasMore,
  };
}

/**
 * SQL condition builder for cursor-based pagination.
 * Returns a WHERE clause condition for "createdAt < cursor.createdAt OR
 * (createdAt = cursor.createdAt AND id < cursor.id)"
 */
export function getCursorCondition(cursor: DecodedCursor): {
  createdAt: Date;
  id: number;
} {
  return {
    createdAt: cursor.createdAt,
    id: cursor.id,
  };
}
