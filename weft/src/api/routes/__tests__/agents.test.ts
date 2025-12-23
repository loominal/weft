import { describe, it, expect } from 'vitest';
import { createAgentsRouter } from '../agents.js';
import { encodeCursor } from '../../../utils/pagination.js';

// Mock request and response objects for testing
function createMockRequest(query: Record<string, any>) {
  return {
    query,
    params: {},
  };
}

function createMockResponse() {
  let statusCode = 200;
  let jsonData: any = null;
  const headers: Record<string, string> = {};

  const res = {
    status: function(code: number) {
      statusCode = code;
      return this;
    },
    json: function(data: any) {
      jsonData = data;
      return this;
    },
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
      return res;
    },
    get statusCode() { return statusCode; },
    get data() { return jsonData; },
    get headers() { return headers; },
  };

  return res;
}

function createMockNext() {
  const errors: any[] = [];
  return {
    fn: (err?: any) => {
      if (err) errors.push(err);
    },
    get errors() { return errors; },
  };
}

describe('Agents Router - Pagination', () => {
  describe('GET /api/agents - Basic pagination', () => {
    it('should return first page without cursor', async () => {
      const mockAgents = Array.from({ length: 100 }, (_, i) => ({
        guid: `agent-${i}`,
        handle: `agent-${i}`,
        agentType: 'claude-code',
        status: 'online',
      }));

      const mockService = {
        listAgents: async (filter: any) => {
          const offset = filter?.offset ?? 0;
          const limit = filter?.limit ?? mockAgents.length;
          return {
            agents: mockAgents.slice(offset, offset + limit),
            total: mockAgents.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = createMockRequest({ limit: '10' });
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.agents).toHaveLength(10);
      expect(res.data.count).toBe(10);
      expect(res.data.total).toBe(100);
      expect(res.data.hasMore).toBe(true);
      expect(res.data.nextCursor).toBeDefined();
      expect(res.data.prevCursor).toBeNull();
    });

    it('should return default limit of 50 when not specified', async () => {
      const mockAgents = Array.from({ length: 100 }, (_, i) => ({
        guid: `agent-${i}`,
        agentType: 'claude-code',
        status: 'online',
      }));

      const mockService = {
        listAgents: async (filter: any) => {
          const offset = filter?.offset ?? 0;
          const limit = filter?.limit ?? 50;
          return {
            agents: mockAgents.slice(offset, offset + limit),
            total: mockAgents.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.agents).toHaveLength(50);
      expect(res.data.count).toBe(50);
      expect(res.data.total).toBe(100);
      expect(res.data.hasMore).toBe(true);
    });

    it('should enforce max limit of 100', async () => {
      const mockAgents = Array.from({ length: 200 }, (_, i) => ({
        guid: `agent-${i}`,
        agentType: 'claude-code',
        status: 'online',
      }));

      const mockService = {
        listAgents: async (filter: any) => {
          const offset = filter?.offset ?? 0;
          const limit = filter?.limit ?? 50;
          return {
            agents: mockAgents.slice(offset, offset + limit),
            total: mockAgents.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      const req = createMockRequest({ limit: '200' }); // Request more than max
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      // Should be capped at 100
      expect(res.data.agents).toHaveLength(100);
      expect(res.data.count).toBe(100);
    });
  });

  describe('GET /api/agents - Cursor-based pagination', () => {
    it('should continue from cursor', async () => {
      const mockAgents = Array.from({ length: 100 }, (_, i) => ({
        guid: `agent-${i}`,
        agentType: 'claude-code',
        status: 'online',
      }));

      const mockService = {
        listAgents: async (filter: any) => {
          const offset = filter?.offset ?? 0;
          const limit = filter?.limit ?? 50;
          return {
            agents: mockAgents.slice(offset, offset + limit),
            total: mockAgents.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      // Create a cursor for offset 50
      const cursor = encodeCursor({ offset: 50, limit: 10 });

      const req = createMockRequest({ cursor });
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.agents).toHaveLength(10);
      expect(res.data.agents[0].guid).toBe('agent-50');
      expect(res.data.prevCursor).toBeDefined(); // Should have previous page
    });

    it('should validate cursor filter consistency', async () => {
      const mockService = {
        listAgents: async () => ({ agents: [], total: 0 }),
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      // Create a cursor with a filter hash
      const cursor = encodeCursor({
        offset: 10,
        limit: 10,
        filterHash: 'wrong-hash',
      });

      const req = createMockRequest({
        cursor,
        status: 'online', // This will create a different hash
      });
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      // Should pass error to next() middleware
      expect(next.errors).toHaveLength(1);
      expect(next.errors[0].message).toContain('filter mismatch');
    });
  });

  describe('GET /api/agents - Backward compatibility', () => {
    it('should return all agents when no limit specified', async () => {
      const mockAgents = Array.from({ length: 25 }, (_, i) => ({
        guid: `agent-${i}`,
        agentType: 'claude-code',
        status: 'online',
      }));

      const mockService = {
        listAgents: async (filter: any) => {
          if (filter?.limit === undefined) {
            return { agents: mockAgents, total: mockAgents.length };
          }
          const offset = filter?.offset ?? 0;
          const limit = filter?.limit;
          return {
            agents: mockAgents.slice(offset, offset + limit),
            total: mockAgents.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      // When limit is not specified, pagination utilities default to 50
      // but service should return all if limit is undefined
      expect(res.data.agents).toHaveLength(25);
      expect(res.data.total).toBe(25);
    });
  });

  describe('GET /api/agents - With filters', () => {
    it('should paginate filtered results', async () => {
      const mockAgents = [
        ...Array.from({ length: 60 }, (_, i) => ({
          guid: `claude-${i}`,
          agentType: 'claude-code',
          status: 'online',
        })),
        ...Array.from({ length: 40 }, (_, i) => ({
          guid: `copilot-${i}`,
          agentType: 'copilot-cli',
          status: 'online',
        })),
      ];

      const mockService = {
        listAgents: async (filter: any) => {
          let filtered = mockAgents;
          if (filter?.agentType) {
            filtered = filtered.filter(a => a.agentType === filter.agentType);
          }

          const offset = filter?.offset ?? 0;
          const limit = filter?.limit ?? 50;
          return {
            agents: filtered.slice(offset, offset + limit),
            total: filtered.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      const req = createMockRequest({ type: 'claude-code', limit: '20' });
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.agents).toHaveLength(20);
      expect(res.data.total).toBe(60); // Only claude-code agents
      expect(res.data.hasMore).toBe(true);
      expect(res.data.agents.every((a: any) => a.agentType === 'claude-code')).toBe(true);
    });
  });

  describe('GET /api/agents - Empty results', () => {
    it('should handle empty result set', async () => {
      const mockService = {
        listAgents: async () => ({ agents: [], total: 0 }),
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = createMockRequest({ limit: '10' });
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.agents).toHaveLength(0);
      expect(res.data.count).toBe(0);
      expect(res.data.total).toBe(0);
      expect(res.data.hasMore).toBe(false);
      expect(res.data.nextCursor).toBeNull();
    });
  });

  describe('GET /api/agents - Last page', () => {
    it('should indicate no more pages on last page', async () => {
      const mockAgents = Array.from({ length: 45 }, (_, i) => ({
        guid: `agent-${i}`,
        agentType: 'claude-code',
        status: 'online',
      }));

      const mockService = {
        listAgents: async (filter: any) => {
          const offset = filter?.offset ?? 0;
          const limit = filter?.limit ?? 50;
          return {
            agents: mockAgents.slice(offset, offset + limit),
            total: mockAgents.length,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack[0]?.route?.stack?.[0]?.handle;

      // Request page starting at offset 40 with limit 10
      const cursor = encodeCursor({ offset: 40, limit: 10 });

      const req = createMockRequest({ cursor });
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.agents).toHaveLength(5); // Only 5 remaining
      expect(res.data.count).toBe(5);
      expect(res.data.hasMore).toBe(false);
      expect(res.data.nextCursor).toBeNull();
    });
  });
});

describe('Agents Router - Batch Operations', () => {
  describe('POST /api/agents/shutdown-batch - GUID selection', () => {
    it('should shutdown agents by explicit GUID list', async () => {
      const mockService = {
        batchShutdownAgents: async (request: any) => {
          return {
            success: request.agentGuids,
            failed: [],
            count: request.agentGuids.length,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: request.agentGuids.length,
            successRate: 100,
            shutdownAgents: request.agentGuids,
            graceful: request.graceful ?? true,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/shutdown-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          agentGuids: ['agent-1', 'agent-2', 'agent-3'],
          graceful: true,
        },
      };
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.success).toHaveLength(3);
      expect(res.data.count).toBe(3);
      expect(res.data.successRate).toBe(100);
      expect(res.data.graceful).toBe(true);
    });

    it('should handle partial failures', async () => {
      const mockService = {
        batchShutdownAgents: async (request: any) => {
          return {
            success: ['agent-1', 'agent-2'],
            failed: ['agent-3'],
            count: 2,
            errors: { 'agent-3': 'Agent currently processing work' },
            completedAt: new Date().toISOString(),
            totalProcessed: 3,
            successRate: 66.67,
            shutdownAgents: ['agent-1', 'agent-2'],
            graceful: false,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/shutdown-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          agentGuids: ['agent-1', 'agent-2', 'agent-3'],
          graceful: false,
        },
      };
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.success).toHaveLength(2);
      expect(res.data.failed).toHaveLength(1);
      expect(res.data.errors['agent-3']).toBe('Agent currently processing work');
      expect(res.data.successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('POST /api/agents/shutdown-batch - Filter selection', () => {
    it('should shutdown agents by filter', async () => {
      const mockService = {
        batchShutdownAgents: async (request: any) => {
          return {
            success: ['idle-1', 'idle-2'],
            failed: [],
            count: 2,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: 2,
            successRate: 100,
            shutdownAgents: ['idle-1', 'idle-2'],
            graceful: true,
          };
        },
      } as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/shutdown-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          filter: {
            status: 'idle',
            idleTimeMs: 300000,
          },
          graceful: true,
        },
      };
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(res.data.success).toHaveLength(2);
      expect(res.data.count).toBe(2);
      expect(res.data.successRate).toBe(100);
    });

    it('should require either filter or agentGuids', async () => {
      const mockService = {} as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/shutdown-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {},
      };
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(next.errors).toHaveLength(1);
      expect(next.errors[0].message).toContain('Either filter or agentGuids must be provided');
    });

    it('should validate agentType filter', async () => {
      const mockService = {} as any;

      const router = createAgentsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/shutdown-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          filter: {
            agentType: 'invalid-type',
          },
        },
      };
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as any, res as any, next.fn);

      expect(next.errors).toHaveLength(1);
      expect(next.errors[0].message).toContain('copilot-cli or claude-code');
    });
  });
});
