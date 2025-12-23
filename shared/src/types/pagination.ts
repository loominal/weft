/**
 * Pagination cursor type
 */
export type PaginationCursor = string;

/**
 * Pagination state for cursor-based pagination
 */
export interface PaginationState {
  /** Current offset in the result set */
  offset: number;

  /** Maximum number of items to return */
  limit: number;

  /** Optional hash of applied filters for cursor validation */
  filterHash?: string;
}

/**
 * Pagination metadata included in responses
 */
export interface PaginationMetadata {
  /** Total count of items in current page/batch */
  count: number;

  /** Total count of all items (may be undefined for performance reasons) */
  total?: number;

  /** Cursor to fetch the next page (null if at end) */
  nextCursor: PaginationCursor | null;

  /** Cursor to fetch the previous page (null if at start) */
  prevCursor: PaginationCursor | null;

  /** Whether more items are available */
  hasMore: boolean;
}
