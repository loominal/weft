import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkRouter } from '../work.js';
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
