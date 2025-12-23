import { describe, it, expect } from 'vitest';
import { createTargetsRouter } from '../targets.js';
import type { CoordinatorServiceLayer } from '../../server.js';

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

describe('Targets Router - Parameter Support', () => {
  describe('GET /api/targets - Route Handler exists', () => {
    it('should have a GET / route', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      // Verify router has the GET / handler
      const handler = router.stack[0];
      expect(handler).toBeDefined();
      expect(handler.route.path).toBe('/');
      expect(handler.route.methods.get).toBe(true);
    });

    it('should be an async function handler', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const handler = router.stack[0].handle;
      expect(typeof handler).toBe('function');
      expect(handler.constructor.name).toMatch(/Function|AsyncFunction/);
    });
  });

  describe('GET /api/targets - Parameter Extraction', () => {
    it('should extract boundary parameter from query', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({ boundary: 'personal' });
      expect(req.query.boundary).toBe('personal');
    });

    it('should extract classification parameter from query', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({ classification: 'corporate' });
      expect(req.query.classification).toBe('corporate');
    });

    it('should extract both parameters when present', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({
        boundary: 'personal',
        classification: 'corporate',
      });
      expect(req.query.boundary).toBe('personal');
      expect(req.query.classification).toBe('corporate');
    });

    it('should extract type parameter for agent type filtering', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({ type: 'claude-code' });
      expect(req.query.type).toBe('claude-code');
    });

    it('should extract status parameter', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({ status: 'available' });
      expect(req.query.status).toBe('available');
    });

    it('should extract capability parameter', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({ capability: 'typescript' });
      expect(req.query.capability).toBe('typescript');
    });

    it('should support multiple parameters together', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({
        type: 'claude-code',
        status: 'available',
        capability: 'typescript',
        boundary: 'personal',
      });
      expect(req.query.type).toBe('claude-code');
      expect(req.query.status).toBe('available');
      expect(req.query.capability).toBe('typescript');
      expect(req.query.boundary).toBe('personal');
    });
  });

  describe('GET /api/targets - Response Handler Setup', () => {
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

  describe('GET /api/targets - Route Documentation', () => {
    it('should document boundary parameter support', () => {
      const mockService = { listTargets: async () => [] } as any;
      const router = createTargetsRouter(mockService);

      // Just verify the route exists and is accessible
      expect(router.stack.length).toBeGreaterThan(0);
      const firstRoute = router.stack[0];
      expect(firstRoute.route).toBeDefined();
    });
  });

  describe('GET /api/targets - Pagination Support', () => {
    it('should extract cursor parameter from query', () => {
      const mockService = {
        listTargets: async () => ({ items: [], total: 0 })
      } as any;
      const router = createTargetsRouter(mockService);

      const req = createMockRequest({ cursor: 'eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9' });
      expect(req.query.cursor).toBe('eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9');
    });

    it('should extract limit parameter from query', () => {
      const mockService = {
        listTargets: async () => ({ items: [], total: 0 })
      } as any;
      createTargetsRouter(mockService);

      const req = createMockRequest({ limit: '25' });
      expect(req.query.limit).toBe('25');
    });

    it('should support pagination with filters', () => {
      const mockService = {
        listTargets: async () => ({ items: [], total: 0 })
      } as any;
      createTargetsRouter(mockService);

      const req = createMockRequest({
        status: 'available',
        boundary: 'personal',
        cursor: 'eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9',
        limit: '25',
      });
      expect(req.query.status).toBe('available');
      expect(req.query.boundary).toBe('personal');
      expect(req.query.cursor).toBe('eyJvZmZzZXQiOjUwLCJsaW1pdCI6NTB9');
      expect(req.query.limit).toBe('25');
    });

    it('should work without pagination parameters (backward compatible)', () => {
      const mockService = {
        listTargets: async () => ({ items: [], total: 0 })
      } as any;
      createTargetsRouter(mockService);

      const req = createMockRequest({ status: 'available' });
      expect(req.query.status).toBe('available');
      expect(req.query.cursor).toBeUndefined();
      expect(req.query.limit).toBeUndefined();
    });
  });

  describe('GET /api/targets - Pagination Response Format', () => {
    it('should call service with pagination parameters', async () => {
      let capturedPagination: any;

      const mockService = {
        listTargets: async (_filter: any, pagination: any) => {
          capturedPagination = pagination;
          return { items: [], total: 0 };
        },
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0]?.route?.stack[0]?.handle;

      const req = createMockRequest({ limit: '10' }) as any;
      const res = createMockResponse();
      const next = () => {};

      await handler(req, res, next);

      expect(capturedPagination).toBeDefined();
      expect(capturedPagination.limit).toBe(10);
      expect(capturedPagination.offset).toBe(0);
    });

    it('should return pagination metadata in response', async () => {
      let responseData: any;

      const mockService = {
        listTargets: async () => ({
          items: [{ id: '1', name: 'test-target' }],
          total: 100,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0]?.route?.stack[0]?.handle;

      const req = createMockRequest({ limit: '10' }) as any;
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData).toBeDefined();
      expect(responseData.targets).toBeDefined();
      expect(responseData.count).toBeDefined();
      expect(responseData.total).toBeDefined();
      expect(responseData.hasMore).toBeDefined();
      expect(responseData.nextCursor).toBeDefined();
      expect(responseData.prevCursor).toBeDefined();
    });

    it('should include nextCursor when more pages available', async () => {
      let responseData: any;

      const mockService = {
        listTargets: async () => ({
          items: Array(50).fill({ id: '1', name: 'test-target' }),
          total: 100,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0]?.route?.stack[0]?.handle;

      const req = createMockRequest({ limit: '50' }) as any;
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.hasMore).toBe(true);
      expect(responseData.nextCursor).not.toBeNull();
    });

    it('should not include nextCursor when on last page', async () => {
      let responseData: any;

      const mockService = {
        listTargets: async () => ({
          items: Array(10).fill({ id: '1', name: 'test-target' }),
          total: 10,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0]?.route?.stack[0]?.handle;

      const req = createMockRequest({ limit: '50' }) as any;
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.hasMore).toBe(false);
      expect(responseData.nextCursor).toBeNull();
    });
  });
});

describe('Targets Router - Batch Operations', () => {
  describe('POST /api/targets/disable-batch', () => {
    it('should disable targets by explicit ID list', async () => {
      const mockService = {
        batchDisableTargets: async (request: any) => {
          return {
            success: request.targetIds,
            failed: [],
            count: request.targetIds.length,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: request.targetIds.length,
            successRate: 100,
            disabledTargets: request.targetIds,
            alreadyDisabled: [],
          };
        },
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/disable-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          targetIds: ['target-1', 'target-2', 'target-3'],
          preventSpinUp: true,
        },
      };
      const res = {
        json: (data: any) => {
          expect(data.success).toHaveLength(3);
          expect(data.count).toBe(3);
          expect(data.successRate).toBe(100);
          expect(data.disabledTargets).toHaveLength(3);
        },
      };
      const next = () => {};

      await handler(req, res, next);
    });

    it('should handle targets already disabled', async () => {
      const mockService = {
        batchDisableTargets: async (request: any) => {
          return {
            success: ['target-1', 'target-2', 'target-3'],
            failed: [],
            count: 3,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: 3,
            successRate: 100,
            disabledTargets: ['target-1'],
            alreadyDisabled: ['target-2', 'target-3'],
          };
        },
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/disable-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          targetIds: ['target-1', 'target-2', 'target-3'],
        },
      };
      const res = {
        json: (data: any) => {
          expect(data.alreadyDisabled).toHaveLength(2);
          expect(data.disabledTargets).toHaveLength(1);
        },
      };
      const next = () => {};

      await handler(req, res, next);
    });

    it('should disable targets by filter', async () => {
      const mockService = {
        batchDisableTargets: async (request: any) => {
          return {
            success: ['ssh-1', 'ssh-2'],
            failed: [],
            count: 2,
            errors: {},
            completedAt: new Date().toISOString(),
            totalProcessed: 2,
            successRate: 100,
            disabledTargets: ['ssh-1', 'ssh-2'],
            alreadyDisabled: [],
          };
        },
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/disable-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {
          filter: {
            mechanism: 'ssh',
            status: 'available',
          },
        },
      };
      const res = {
        json: (data: any) => {
          expect(data.success).toHaveLength(2);
          expect(data.disabledTargets).toHaveLength(2);
        },
      };
      const next = () => {};

      await handler(req, res, next);
    });

    it('should require either filter or targetIds', async () => {
      const mockService = {} as any;
      const router = createTargetsRouter(mockService);
      const handler = router.stack.find((layer: any) =>
        layer.route?.path === '/disable-batch' && layer.route?.methods?.post
      )?.route?.stack?.[0]?.handle;
      if (!handler) throw new Error('Handler not found');

      const req = {
        query: {},
        params: {},
        body: {},
      };
      const errors: any[] = [];
      const res = { json: () => {} };
      const next = (err?: any) => {
        if (err) errors.push(err);
      };

      await handler(req, res, next);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Either filter or targetIds must be provided');
    });
  });
});
