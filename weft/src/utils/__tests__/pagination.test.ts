/**
 * Tests for pagination utilities
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  validateCursor,
  createFilterHash,
  createPaginationMetadata,
  parsePaginationQuery,
  parsePaginationArgs,
} from '../pagination.js';
import type { PaginationState } from '@loominal/shared';

describe('pagination utilities', () => {
  describe('encodeCursor', () => {
    it('should encode pagination state to base64url string', () => {
      const state: PaginationState = { offset: 20, limit: 10 };
      const cursor = encodeCursor(state);

      expect(typeof cursor).toBe('string');
      expect(cursor.length).toBeGreaterThan(0);
      // base64url should not contain +, /, or =
      expect(cursor).not.toMatch(/[+/=]/);
    });

    it('should encode state with filterHash', () => {
      const state: PaginationState = { offset: 20, limit: 10, filterHash: 'abc123' };
      const cursor = encodeCursor(state);

      expect(cursor).toBeTruthy();
    });

    it('should produce consistent cursors for same state', () => {
      const state: PaginationState = { offset: 50, limit: 25 };
      const cursor1 = encodeCursor(state);
      const cursor2 = encodeCursor(state);

      expect(cursor1).toBe(cursor2);
    });
  });

  describe('decodeCursor', () => {
    it('should decode valid cursor back to state', () => {
      const originalState: PaginationState = { offset: 100, limit: 50 };
      const cursor = encodeCursor(originalState);
      const decodedState = decodeCursor(cursor);

      expect(decodedState).toEqual(originalState);
    });

    it('should decode state with filterHash', () => {
      const originalState: PaginationState = { offset: 10, limit: 20, filterHash: 'xyz789' };
      const cursor = encodeCursor(originalState);
      const decodedState = decodeCursor(cursor);

      expect(decodedState).toEqual(originalState);
    });

    it('should throw on invalid base64', () => {
      expect(() => decodeCursor('not-valid-base64!!!')).toThrow(/Invalid pagination cursor/);
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = Buffer.from('not json', 'utf-8').toString('base64url');
      expect(() => decodeCursor(invalidJson)).toThrow(/Invalid pagination cursor/);
    });

    it('should throw on negative offset', () => {
      const invalidState = { offset: -1, limit: 10 };
      const json = JSON.stringify(invalidState);
      const cursor = Buffer.from(json, 'utf-8').toString('base64url');

      expect(() => decodeCursor(cursor)).toThrow(/Invalid offset in cursor/);
    });

    it('should throw on zero limit', () => {
      const invalidState = { offset: 0, limit: 0 };
      const json = JSON.stringify(invalidState);
      const cursor = Buffer.from(json, 'utf-8').toString('base64url');

      expect(() => decodeCursor(cursor)).toThrow(/Invalid limit in cursor/);
    });

    it('should throw on limit > 1000', () => {
      const invalidState = { offset: 0, limit: 1001 };
      const json = JSON.stringify(invalidState);
      const cursor = Buffer.from(json, 'utf-8').toString('base64url');

      expect(() => decodeCursor(cursor)).toThrow(/Invalid limit in cursor/);
    });
  });

  describe('validateCursor', () => {
    it('should return valid for correct cursor', () => {
      const state: PaginationState = { offset: 10, limit: 20 };
      const cursor = encodeCursor(state);
      const result = validateCursor(cursor);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for malformed cursor', () => {
      const result = validateCursor('invalid-cursor');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate matching filterHash', () => {
      const filterHash = 'abc123';
      const state: PaginationState = { offset: 10, limit: 20, filterHash };
      const cursor = encodeCursor(state);
      const result = validateCursor(cursor, filterHash);

      expect(result.valid).toBe(true);
    });

    it('should detect filterHash mismatch', () => {
      const state: PaginationState = { offset: 10, limit: 20, filterHash: 'abc123' };
      const cursor = encodeCursor(state);
      const result = validateCursor(cursor, 'different-hash');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('filter mismatch');
    });

    it('should allow cursor without filterHash when hash not provided', () => {
      const state: PaginationState = { offset: 10, limit: 20 };
      const cursor = encodeCursor(state);
      const result = validateCursor(cursor);

      expect(result.valid).toBe(true);
    });

    it('should allow cursor without filterHash when validation hash is provided', () => {
      const state: PaginationState = { offset: 10, limit: 20 };
      const cursor = encodeCursor(state);
      const result = validateCursor(cursor, 'some-hash');

      expect(result.valid).toBe(true);
    });
  });

  describe('createFilterHash', () => {
    it('should create consistent hash for same filters', () => {
      const filters = { status: 'active', role: 'admin' };
      const hash1 = createFilterHash(filters);
      const hash2 = createFilterHash(filters);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });

    it('should create consistent hash regardless of key order', () => {
      const filters1 = { a: 1, b: 2, c: 3 };
      const filters2 = { c: 3, a: 1, b: 2 };
      const hash1 = createFilterHash(filters1);
      const hash2 = createFilterHash(filters2);

      expect(hash1).toBe(hash2);
    });

    it('should create different hash for different filters', () => {
      const filters1 = { status: 'active' };
      const filters2 = { status: 'inactive' };
      const hash1 = createFilterHash(filters1);
      const hash2 = createFilterHash(filters2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty filters', () => {
      const hash = createFilterHash({});
      expect(hash.length).toBe(16);
    });

    it('should handle complex nested filters', () => {
      const filters = {
        status: 'active',
        metadata: { tags: ['tag1', 'tag2'] },
        count: 42,
      };
      const hash = createFilterHash(filters);

      expect(hash.length).toBe(16);
    });
  });

  describe('createPaginationMetadata', () => {
    it('should create metadata for first page with more results', () => {
      const metadata = createPaginationMetadata({
        count: 20,
        offset: 0,
        limit: 20,
      });

      expect(metadata.count).toBe(20);
      expect(metadata.hasMore).toBe(true); // Full page suggests more
      expect(metadata.nextCursor).toBeTruthy();
      expect(metadata.prevCursor).toBeNull();
      expect(metadata.total).toBeUndefined();
    });

    it('should create metadata for middle page', () => {
      const metadata = createPaginationMetadata({
        count: 20,
        offset: 20,
        limit: 20,
      });

      expect(metadata.count).toBe(20);
      expect(metadata.hasMore).toBe(true);
      expect(metadata.nextCursor).toBeTruthy();
      expect(metadata.prevCursor).toBeTruthy();
    });

    it('should create metadata for last page (partial results)', () => {
      const metadata = createPaginationMetadata({
        count: 15,
        offset: 40,
        limit: 20,
      });

      expect(metadata.count).toBe(15);
      expect(metadata.hasMore).toBe(false); // Partial page means no more
      expect(metadata.nextCursor).toBeNull();
      expect(metadata.prevCursor).toBeTruthy();
    });

    it('should create metadata with known total', () => {
      const metadata = createPaginationMetadata({
        count: 20,
        total: 100,
        offset: 0,
        limit: 20,
      });

      expect(metadata.count).toBe(20);
      expect(metadata.total).toBe(100);
      expect(metadata.hasMore).toBe(true);
      expect(metadata.nextCursor).toBeTruthy();
    });

    it('should create metadata for last page with known total', () => {
      const metadata = createPaginationMetadata({
        count: 10,
        total: 50,
        offset: 40,
        limit: 20,
      });

      expect(metadata.count).toBe(10);
      expect(metadata.total).toBe(50);
      expect(metadata.hasMore).toBe(false);
      expect(metadata.nextCursor).toBeNull();
    });

    it('should include filterHash in cursors when provided', () => {
      const filterHash = 'test-hash';
      const metadata = createPaginationMetadata({
        count: 20,
        offset: 0,
        limit: 20,
        filterHash,
      });

      expect(metadata.nextCursor).toBeTruthy();
      const nextState = decodeCursor(metadata.nextCursor!);
      expect(nextState.filterHash).toBe(filterHash);
    });

    it('should handle zero results', () => {
      const metadata = createPaginationMetadata({
        count: 0,
        offset: 0,
        limit: 20,
      });

      expect(metadata.count).toBe(0);
      expect(metadata.hasMore).toBe(false);
      expect(metadata.nextCursor).toBeNull();
      expect(metadata.prevCursor).toBeNull();
    });
  });

  describe('parsePaginationQuery (Express)', () => {
    it('should parse cursor from query string', () => {
      const originalState: PaginationState = { offset: 20, limit: 10 };
      const cursor = encodeCursor(originalState);
      const state = parsePaginationQuery({ cursor });

      expect(state).toEqual(originalState);
    });

    it('should use default limit when not provided', () => {
      const state = parsePaginationQuery({});

      expect(state.offset).toBe(0);
      expect(state.limit).toBe(50); // default
    });

    it('should use custom default limit', () => {
      const state = parsePaginationQuery({}, 25);

      expect(state.offset).toBe(0);
      expect(state.limit).toBe(25);
    });

    it('should parse string limit from query', () => {
      const state = parsePaginationQuery({ limit: '30' });

      expect(state.offset).toBe(0);
      expect(state.limit).toBe(30);
    });

    it('should enforce max limit', () => {
      const state = parsePaginationQuery({ limit: '200' }, 50, 100);

      expect(state.limit).toBe(100); // capped at max
    });

    it('should enforce min limit of 1', () => {
      const state = parsePaginationQuery({ limit: '0' });

      expect(state.limit).toBe(1);
    });

    it('should handle invalid limit strings', () => {
      const state = parsePaginationQuery({ limit: 'invalid' }, 50);

      expect(state.limit).toBe(50); // falls back to default
    });

    it('should parse offset from query', () => {
      const state = parsePaginationQuery({ offset: '40' });

      expect(state.offset).toBe(40);
      expect(state.limit).toBe(50);
    });

    it('should prevent negative offset', () => {
      const state = parsePaginationQuery({ offset: '-10' });

      expect(state.offset).toBe(0);
    });

    it('should allow limit override when cursor provided', () => {
      const originalState: PaginationState = { offset: 20, limit: 10 };
      const cursor = encodeCursor(originalState);
      const state = parsePaginationQuery({ cursor, limit: '30' });

      expect(state.offset).toBe(20); // from cursor
      expect(state.limit).toBe(30); // overridden
    });

    it('should use cursor limit when no override', () => {
      const originalState: PaginationState = { offset: 20, limit: 15 };
      const cursor = encodeCursor(originalState);
      const state = parsePaginationQuery({ cursor });

      expect(state.offset).toBe(20);
      expect(state.limit).toBe(15); // from cursor
    });
  });

  describe('parsePaginationArgs (MCP compatibility)', () => {
    it('should parse cursor from args', () => {
      const originalState: PaginationState = { offset: 30, limit: 15 };
      const cursor = encodeCursor(originalState);
      const state = parsePaginationArgs({ cursor });

      expect(state).toEqual(originalState);
    });

    it('should use default limit (20) when not provided', () => {
      const state = parsePaginationArgs({});

      expect(state.offset).toBe(0);
      expect(state.limit).toBe(20); // MCP default
    });

    it('should parse numeric limit from args', () => {
      const state = parsePaginationArgs({ limit: 40 });

      expect(state.offset).toBe(0);
      expect(state.limit).toBe(40);
    });

    it('should enforce max limit', () => {
      const state = parsePaginationArgs({ limit: 500 }, 20, 100);

      expect(state.limit).toBe(100);
    });

    it('should enforce min limit of 1', () => {
      const state = parsePaginationArgs({ limit: -5 });

      expect(state.limit).toBe(1);
    });

    it('should allow limit override with cursor', () => {
      const originalState: PaginationState = { offset: 10, limit: 10 };
      const cursor = encodeCursor(originalState);
      const state = parsePaginationArgs({ cursor, limit: 25 });

      expect(state.offset).toBe(10);
      expect(state.limit).toBe(25);
    });
  });

  describe('round-trip encoding', () => {
    it('should support multiple encode/decode cycles', () => {
      const state1: PaginationState = { offset: 0, limit: 20 };
      const cursor1 = encodeCursor(state1);
      const decoded1 = decodeCursor(cursor1);

      const state2: PaginationState = { offset: decoded1.offset + decoded1.limit, limit: 20 };
      const cursor2 = encodeCursor(state2);
      const decoded2 = decodeCursor(cursor2);

      expect(decoded2.offset).toBe(20);
      expect(decoded2.limit).toBe(20);
    });

    it('should maintain filterHash through cycles', () => {
      const filterHash = createFilterHash({ status: 'active' });
      const state: PaginationState = { offset: 0, limit: 20, filterHash };
      const cursor = encodeCursor(state);
      const decoded = decodeCursor(cursor);

      expect(decoded.filterHash).toBe(filterHash);
    });
  });
});
