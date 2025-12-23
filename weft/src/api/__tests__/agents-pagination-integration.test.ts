import { describe, it, expect } from 'vitest';
import type { RegisteredAgent } from '@loominal/shared';
import { parsePaginationQuery, createPaginationMetadata, createFilterHash } from '../../utils/pagination.js';

describe('Agents Pagination - Integration', () => {
  it('should handle complete pagination flow', () => {
    // Simulate 100 agents
    const allAgents: RegisteredAgent[] = Array.from({ length: 100 }, (_, i) => ({
      guid: `agent-${i}`,
      handle: `agent-${i}`,
      agentType: 'claude-code',
      status: 'online',
      capabilities: ['general'],
      projectId: 'test-project',
      lastSeen: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
    }));

    // Page 1: Get first 20 agents
    const filter1 = { agentType: 'claude-code' };
    const pagination1 = parsePaginationQuery({ limit: '20' });
    const filterHash1 = createFilterHash(filter1);

    const page1 = allAgents.slice(pagination1.offset, pagination1.offset + pagination1.limit);
    const metadata1 = createPaginationMetadata({
      count: page1.length,
      total: allAgents.length,
      offset: pagination1.offset,
      limit: pagination1.limit,
      filterHash: filterHash1,
    });

    expect(page1).toHaveLength(20);
    expect(metadata1.count).toBe(20);
    expect(metadata1.total).toBe(100);
    expect(metadata1.hasMore).toBe(true);
    expect(metadata1.nextCursor).toBeDefined();
    expect(metadata1.prevCursor).toBeNull();

    // Page 2: Use cursor from page 1
    const pagination2 = parsePaginationQuery({ cursor: metadata1.nextCursor! });
    const page2 = allAgents.slice(pagination2.offset, pagination2.offset + pagination2.limit);
    const metadata2 = createPaginationMetadata({
      count: page2.length,
      total: allAgents.length,
      offset: pagination2.offset,
      limit: pagination2.limit,
      filterHash: filterHash1,
    });

    expect(page2).toHaveLength(20);
    expect(page2[0].guid).toBe('agent-20'); // Continues from where page 1 left off
    expect(metadata2.prevCursor).toBeDefined();
    expect(metadata2.hasMore).toBe(true);

    // Last page: Jump to end
    const pagination5 = parsePaginationQuery({ cursor: metadata2.nextCursor! });
    const finalPagination = parsePaginationQuery({
      cursor: metadata2.nextCursor!,
      offset: '80',
      limit: '20',
    });
    const finalPage = allAgents.slice(80, 100);
    const finalMetadata = createPaginationMetadata({
      count: finalPage.length,
      total: allAgents.length,
      offset: 80,
      limit: 20,
      filterHash: filterHash1,
    });

    expect(finalPage).toHaveLength(20);
    expect(finalMetadata.hasMore).toBe(false);
    expect(finalMetadata.nextCursor).toBeNull();
  });

  it('should enforce max limit', () => {
    const pagination = parsePaginationQuery({ limit: '200' }, 50, 100);
    expect(pagination.limit).toBe(100); // Capped at max
  });

  it('should use default limit when not specified', () => {
    const pagination = parsePaginationQuery({}, 50, 100);
    expect(pagination.limit).toBe(50); // Default
  });

  it('should handle filter changes between requests', () => {
    const filter1 = { agentType: 'claude-code', status: 'online' };
    const filter2 = { agentType: 'claude-code', status: 'busy' };

    const hash1 = createFilterHash(filter1);
    const hash2 = createFilterHash(filter2);

    expect(hash1).not.toBe(hash2);
  });
});
