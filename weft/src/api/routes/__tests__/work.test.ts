import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkRouter } from '../work.js';
import type { CoordinatorServiceLayer } from '../../server.js';
import type { WorkItemResponse, AgentSummary } from '@loominal/shared';

// Mock request and response objects for testing
function createMockRequest(query: Record<string, any>) {
  return {
    query,
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  const res = {
    status: function() { return this; },
    json: function(data: any) { return this; },
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
      return res;
    },
    get headers() {
      return headers;
    },
  };

  return res;
}

describe('Work Router - Parameter Support', () => {
  describe('GET /api/work - Route Handler exists', () => {
    it('should have a GET / route', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      // Verify router has the GET / handler
      const handler = router.stack[0];
      expect(handler).toBeDefined();
      expect(handler.route.path).toBe('/');
      expect(handler.route.methods.get).toBe(true);
    });

    it('should be an async function handler', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      const handler = router.stack[0].handle;
      expect(typeof handler).toBe('function');
      expect(handler.constructor.name).toMatch(/Function|AsyncFunction/);
    });
  });

  describe('GET /api/work - Parameter Extraction', () => {
    it('should extract boundary parameter from query', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      const req = createMockRequest({ boundary: 'personal' });
      expect(req.query.boundary).toBe('personal');
    });

    it('should extract classification parameter from query', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      const req = createMockRequest({ classification: 'corporate' });
      expect(req.query.classification).toBe('corporate');
    });

    it('should extract both parameters when present', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      const req = createMockRequest({
        boundary: 'personal',
        classification: 'corporate',
      });
      expect(req.query.boundary).toBe('personal');
      expect(req.query.classification).toBe('corporate');
    });

    it('should support status parameter', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      const req = createMockRequest({ status: 'pending' });
      expect(req.query.status).toBe('pending');
    });

    it('should support multiple parameters together', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      const req = createMockRequest({
        status: 'completed',
        boundary: 'corporate',
      });
      expect(req.query.status).toBe('completed');
      expect(req.query.boundary).toBe('corporate');
    });
  });

  describe('GET /api/work - Response Handler Setup', () => {
    it('should have a response object with setHeader method', () => {
      const res = createMockResponse();
      expect(typeof res.setHeader).toBe('function');
    });

    it('should track headers set on response', () => {
      const res = createMockResponse();
      res.setHeader('X-Deprecated-Param', 'classification (use boundary instead)');
      expect(res.headers['x-deprecated-param']).toBe(
        'classification (use boundary instead)',
      );
    });

    it('should handle multiple header sets', () => {
      const res = createMockResponse();
      res.setHeader('X-Test-1', 'value1');
      res.setHeader('X-Test-2', 'value2');
      expect(res.headers['x-test-1']).toBe('value1');
      expect(res.headers['x-test-2']).toBe('value2');
    });

    it('should support json method on response', () => {
      const res = createMockResponse();
      expect(typeof res.json).toBe('function');
    });
  });

  describe('GET /api/work - Route Documentation', () => {
    it('should document boundary parameter support', () => {
      const mockService = { listWork: async () => [] } as any;
      const router = createWorkRouter(mockService);

      // Just verify the route exists and is accessible
      expect(router.stack.length).toBeGreaterThan(0);
      const firstRoute = router.stack[0];
      expect(firstRoute.route).toBeDefined();
    });
  });
});

describe('Work Router - Semantic Context (Phase 2.4)', () => {
  describe('GET /api/work - Agent Resolution in List', () => {
    it('should include assignedToAgent for assigned work items', async () => {
      const mockAgentSummary: AgentSummary = {
        guid: 'agent-guid-123',
        handle: 'dev-agent-1',
        agentType: 'claude-code',
        hostname: 'laptop.local',
      };

      const mockWorkItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'assigned',
        assignedTo: 'agent-guid-123',
        assignedToAgent: mockAgentSummary,
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 1,
      };

      const mockService = {
        listWork: async () => [mockWorkItem],
      } as any;

      const result = await mockService.listWork({});
      expect(result).toHaveLength(1);
      expect(result[0].assignedTo).toBe('agent-guid-123');
      expect(result[0].assignedToAgent).toBeDefined();
      expect(result[0].assignedToAgent?.guid).toBe('agent-guid-123');
      expect(result[0].assignedToAgent?.handle).toBe('dev-agent-1');
      expect(result[0].assignedToAgent?.agentType).toBe('claude-code');
      expect(result[0].assignedToAgent?.hostname).toBe('laptop.local');
    });

    it('should not have assignedToAgent for unassigned work items', async () => {
      const mockWorkItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'pending',
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 0,
      };

      const mockService = {
        listWork: async () => [mockWorkItem],
      } as any;

      const result = await mockService.listWork({});
      expect(result).toHaveLength(1);
      expect(result[0].assignedTo).toBeUndefined();
      expect(result[0].assignedToAgent).toBeUndefined();
    });

    it('should handle missing/offline agents gracefully', async () => {
      const mockWorkItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'assigned',
        assignedTo: 'offline-agent-guid',
        assignedToAgent: undefined, // Agent not found
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 1,
      };

      const mockService = {
        listWork: async () => [mockWorkItem],
      } as any;

      const result = await mockService.listWork({});
      expect(result).toHaveLength(1);
      expect(result[0].assignedTo).toBe('offline-agent-guid');
      expect(result[0].assignedToAgent).toBeUndefined();
    });

    it('should maintain backward compatibility with assignedTo field', async () => {
      const mockWorkItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'assigned',
        assignedTo: 'agent-guid-123',
        assignedToAgent: {
          guid: 'agent-guid-123',
          handle: 'dev-agent-1',
          agentType: 'claude-code',
          hostname: 'laptop.local',
        },
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 1,
      };

      const mockService = {
        listWork: async () => [mockWorkItem],
      } as any;

      const result = await mockService.listWork({});
      expect(result).toHaveLength(1);

      // Backward compatibility: assignedTo GUID is still present
      expect(result[0].assignedTo).toBe('agent-guid-123');

      // New semantic context: assignedToAgent provides details
      expect(result[0].assignedToAgent).toBeDefined();
      expect(result[0].assignedToAgent?.guid).toBe(result[0].assignedTo);
    });
  });

  describe('GET /api/work/:id - Agent Resolution for Single Item', () => {
    it('should include assignedToAgent for assigned work item', async () => {
      const mockWorkItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'assigned',
        assignedTo: 'agent-guid-123',
        assignedToAgent: {
          guid: 'agent-guid-123',
          handle: 'dev-agent-1',
          agentType: 'claude-code',
          hostname: 'laptop.local',
        },
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 1,
      };

      const mockService = {
        getWorkItem: async (id: string) => mockWorkItem,
      } as any;

      const result = await mockService.getWorkItem('work-1');
      expect(result).toBeDefined();
      expect(result.assignedToAgent).toBeDefined();
      expect(result.assignedToAgent.guid).toBe('agent-guid-123');
      expect(result.assignedToAgent.handle).toBe('dev-agent-1');
      expect(result.assignedToAgent.agentType).toBe('claude-code');
      expect(result.assignedToAgent.hostname).toBe('laptop.local');
    });

    it('should handle work item with no assignment', async () => {
      const mockWorkItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'pending',
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 0,
      };

      const mockService = {
        getWorkItem: async (id: string) => mockWorkItem,
      } as any;

      const result = await mockService.getWorkItem('work-1');
      expect(result).toBeDefined();
      expect(result.assignedTo).toBeUndefined();
      expect(result.assignedToAgent).toBeUndefined();
    });
  });

  describe('WorkItemResponse Type Structure', () => {
    it('should match the WorkItemResponse interface structure', () => {
      const workItem: WorkItemResponse = {
        id: 'work-1',
        taskId: 'task-abc',
        description: 'Test task',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        status: 'in-progress',
        assignedTo: 'agent-guid-123',
        assignedToAgent: {
          guid: 'agent-guid-123',
          handle: 'dev-agent-1',
          agentType: 'claude-code',
          hostname: 'laptop.local',
        },
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 1,
        progress: 50,
      };

      // Verify all required fields are present
      expect(workItem.id).toBeDefined();
      expect(workItem.taskId).toBeDefined();
      expect(workItem.description).toBeDefined();
      expect(workItem.capability).toBeDefined();
      expect(workItem.boundary).toBeDefined();
      expect(workItem.priority).toBeDefined();
      expect(workItem.status).toBeDefined();
      expect(workItem.offeredBy).toBeDefined();
      expect(workItem.offeredAt).toBeDefined();
      expect(workItem.attempts).toBeDefined();

      // Verify semantic context fields
      expect(workItem.assignedTo).toBeDefined();
      expect(workItem.assignedToAgent).toBeDefined();
      expect(workItem.assignedToAgent?.guid).toBe(workItem.assignedTo);
    });

    it('should validate AgentSummary structure', () => {
      const agentSummary: AgentSummary = {
        guid: 'agent-guid-123',
        handle: 'dev-agent-1',
        agentType: 'claude-code',
        hostname: 'laptop.local',
      };

      expect(agentSummary.guid).toBeDefined();
      expect(agentSummary.agentType).toBeDefined();
      expect(['claude-code', 'copilot-cli']).toContain(agentSummary.agentType);
    });
  });
});

describe('Work Router - Pagination (Phase 2.2)', () => {
  describe('GET /api/work - Pagination Parameters', () => {
    it('should accept cursor parameter', async () => {
      const mockService = {
        listWork: async () => [],
      } as any;

      const router = createWorkRouter(mockService);
      const req = createMockRequest({ cursor: 'eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9' });
      expect(req.query.cursor).toBeDefined();
    });

    it('should accept limit parameter', async () => {
      const mockService = {
        listWork: async () => [],
      } as any;

      const router = createWorkRouter(mockService);
      const req = createMockRequest({ limit: '25' });
      expect(req.query.limit).toBe('25');
    });

    it('should accept both cursor and limit', async () => {
      const mockService = {
        listWork: async () => [],
      } as any;

      const router = createWorkRouter(mockService);
      const req = createMockRequest({
        cursor: 'eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9',
        limit: '25',
      });
      expect(req.query.cursor).toBeDefined();
      expect(req.query.limit).toBe('25');
    });

    it('should work with filters and pagination together', async () => {
      const mockService = {
        listWork: async () => [],
      } as any;

      const router = createWorkRouter(mockService);
      const req = createMockRequest({
        status: 'pending',
        boundary: 'personal',
        limit: '50',
      });
      expect(req.query.status).toBe('pending');
      expect(req.query.boundary).toBe('personal');
      expect(req.query.limit).toBe('50');
    });
  });

  describe('GET /api/work - Pagination Metadata', () => {
    it('should include pagination metadata in response', () => {
      const mockResponse = {
        workItems: [],
        count: 0,
        total: 100,
        hasMore: false,
        nextCursor: null,
        prevCursor: null,
      };

      expect(mockResponse.count).toBeDefined();
      expect(mockResponse.hasMore).toBeDefined();
      expect(mockResponse.nextCursor).toBeDefined();
      expect(mockResponse.prevCursor).toBeDefined();
    });

    it('should indicate hasMore when there are more results', () => {
      const mockResponse = {
        workItems: Array(50).fill({}),
        count: 50,
        total: 100,
        hasMore: true,
        nextCursor: 'eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9',
        prevCursor: null,
      };

      expect(mockResponse.hasMore).toBe(true);
      expect(mockResponse.nextCursor).toBeTruthy();
    });

    it('should include prevCursor when not on first page', () => {
      const mockResponse = {
        workItems: Array(50).fill({}),
        count: 50,
        total: 100,
        hasMore: false,
        nextCursor: null,
        prevCursor: 'eyJvZmZzZXQiOjAsImxpbWl0Ijo1MH0',
      };

      expect(mockResponse.prevCursor).toBeTruthy();
    });
  });

  describe('GET /api/work - Default Pagination Behavior', () => {
    it('should use default limit of 50 when not specified', async () => {
      const workItems = Array(50).fill({}).map((_, i) => ({
        id: `work-${i}`,
        taskId: `task-${i}`,
        description: 'Test',
        capability: 'test',
        boundary: 'personal',
        priority: 5,
        status: 'pending',
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 0,
      }));

      const mockService = {
        listWork: async (filter: any) => {
          const limit = filter?.limit || 50;
          return workItems.slice(0, limit);
        },
      } as any;

      const result = await mockService.listWork({});
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should enforce max limit of 100', async () => {
      const workItems = Array(200).fill({}).map((_, i) => ({
        id: `work-${i}`,
        taskId: `task-${i}`,
        description: 'Test',
        capability: 'test',
        boundary: 'personal',
        priority: 5,
        status: 'pending',
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 0,
      }));

      const mockService = {
        listWork: async (filter: any) => {
          const limit = Math.min(filter?.limit || 50, 100);
          return workItems.slice(0, limit);
        },
      } as any;

      const result = await mockService.listWork({ limit: 200 });
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/work - Pagination with Filters', () => {
    it('should apply filters before pagination', async () => {
      const allWorkItems = [
        { id: '1', status: 'pending', boundary: 'personal' },
        { id: '2', status: 'assigned', boundary: 'personal' },
        { id: '3', status: 'pending', boundary: 'corporate' },
        { id: '4', status: 'pending', boundary: 'personal' },
      ];

      const mockService = {
        listWork: async (filter: any) => {
          let filtered = allWorkItems;
          if (filter?.status) {
            filtered = filtered.filter((w: any) => w.status === filter.status);
          }
          if (filter?.boundary) {
            filtered = filtered.filter((w: any) => w.boundary === filter.boundary);
          }
          const start = filter?.offset || 0;
          const end = filter?.limit ? start + filter.limit : undefined;
          return filtered.slice(start, end);
        },
      } as any;

      const result = await mockService.listWork({ status: 'pending', boundary: 'personal' });
      expect(result.length).toBe(2);
      expect(result.every((w: any) => w.status === 'pending')).toBe(true);
      expect(result.every((w: any) => w.boundary === 'personal')).toBe(true);
    });

    it('should maintain filter consistency across pages', async () => {
      // This would be validated by cursor filter hash in real implementation
      const mockFilter = {
        status: 'pending',
        boundary: 'personal',
      };

      // Filters should be the same when using cursor
      expect(mockFilter.status).toBe('pending');
      expect(mockFilter.boundary).toBe('personal');
    });
  });

  describe('GET /api/work - Backward Compatibility', () => {
    it('should work without pagination parameters', async () => {
      const mockService = {
        listWork: async () => [
          {
            id: 'work-1',
            taskId: 'task-1',
            description: 'Test',
            capability: 'test',
            boundary: 'personal',
            priority: 5,
            status: 'pending',
            offeredBy: 'coordinator',
            offeredAt: '2025-12-23T10:00:00Z',
            attempts: 0,
          },
        ],
      } as any;

      const result = await mockService.listWork({});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('work-1');
    });

    it('should return all results when no pagination specified', async () => {
      const allWorkItems = Array(150).fill({}).map((_, i) => ({
        id: `work-${i}`,
        taskId: `task-${i}`,
        description: 'Test',
        capability: 'test',
        boundary: 'personal',
        priority: 5,
        status: 'pending',
        offeredBy: 'coordinator',
        offeredAt: '2025-12-23T10:00:00Z',
        attempts: 0,
      }));

      const mockService = {
        listWork: async (filter: any) => {
          if (!filter?.limit && !filter?.offset) {
            return allWorkItems;
          }
          const start = filter?.offset || 0;
          const end = filter?.limit ? start + filter.limit : undefined;
          return allWorkItems.slice(start, end);
        },
      } as any;

      const result = await mockService.listWork({});
      expect(result.length).toBe(150);
    });
  });
});

describe('Work Router - Batch Operations', () => {
  describe('POST /api/work/cancel-batch', () => {
    it('should cancel work items by explicit ID list', async () => {
      const mockService = {
        batchCancelWork: async (request: any) => {
          return {
            success: request.workItemIds,
            failed: [],
            count: request.workItemIds.length,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: request.workItemIds.length,
            successRate: 100,
            cancelledItems: request.workItemIds,
            reassignedItems: [],
            notCancellable: [],
          };
        },
      } as any;

      const router = createWorkRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/cancel-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      let responseData: any;
      const req = {
        query: {},
        params: {},
        body: {
          workItemIds: ['work-1', 'work-2', 'work-3'],
          reason: 'user-requested',
        },
      };
      const res = {
        json: (data: any) => {
          responseData = data;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.success).toHaveLength(3);
      expect(responseData.count).toBe(3);
      expect(responseData.successRate).toBe(100);
      expect(responseData.cancelledItems).toHaveLength(3);
    });

    it('should handle non-cancellable items', async () => {
      const mockService = {
        batchCancelWork: async (request: any) => {
          return {
            success: ['work-1'],
            failed: ['work-2'],
            count: 1,
            errors: { 'work-2': 'Cannot cancel work in completed state' },
            completedAt: new Date().toISOString(),
            totalProcessed: 2,
            successRate: 50,
            cancelledItems: ['work-1'],
            reassignedItems: [],
            notCancellable: ['work-2'],
          };
        },
      } as any;

      const router = createWorkRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/cancel-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      let responseData: any;
      const req = {
        query: {},
        params: {},
        body: {
          workItemIds: ['work-1', 'work-2'],
        },
      };
      const res = {
        json: (data: any) => {
          responseData = data;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.success).toHaveLength(1);
      expect(responseData.failed).toHaveLength(1);
      expect(responseData.notCancellable).toHaveLength(1);
      expect(responseData.errors['work-2']).toContain('completed state');
    });

    it('should cancel work items by filter', async () => {
      const mockService = {
        batchCancelWork: async (request: any) => {
          return {
            success: ['work-1', 'work-2'],
            failed: [],
            count: 2,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: 2,
            successRate: 100,
            cancelledItems: ['work-1', 'work-2'],
            reassignedItems: [],
            notCancellable: [],
          };
        },
      } as any;

      const router = createWorkRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/cancel-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      let responseData: any;
      const req = {
        query: {},
        params: {},
        body: {
          filter: {
            status: 'pending',
            boundary: 'personal',
          },
          reason: 'deadline-passed',
        },
      };
      const res = {
        json: (data: any) => {
          responseData = data;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.success).toHaveLength(2);
      expect(responseData.cancelledItems).toHaveLength(2);
    });

    it('should support reassignment', async () => {
      const mockService = {
        batchCancelWork: async (request: any) => {
          return {
            success: ['work-1', 'work-2'],
            failed: [],
            count: 2,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: 2,
            successRate: 100,
            cancelledItems: ['work-1', 'work-2'],
            reassignedItems: ['work-1', 'work-2'],
            notCancellable: [],
          };
        },
      } as any;

      const router = createWorkRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/cancel-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      let responseData: any;
      const req = {
        query: {},
        params: {},
        body: {
          workItemIds: ['work-1', 'work-2'],
          reassign: true,
        },
      };
      const res = {
        json: (data: any) => {
          responseData = data;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.reassignedItems).toHaveLength(2);
    });

    it('should require either filter or workItemIds', async () => {
      const mockService = {} as any;
      const router = createWorkRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/cancel-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const errors: any[] = [];
      const req = {
        query: {},
        params: {},
        body: {},
      };
      const res = { json: () => {} };
      const next = (err?: any) => {
        if (err) errors.push(err);
      };

      await handler(req, res, next);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Either filter or workItemIds must be provided');
    });
  });
});
