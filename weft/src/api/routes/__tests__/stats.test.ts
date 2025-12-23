import { describe, it, expect } from 'vitest';
import { createStatsRouter } from '../stats.js';
import { generateETag } from '../../middleware/cache.js';

// Mock request and response objects for testing
function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers,
    query: {},
    params: {},
  };
}

function createMockResponse() {
  let statusCode = 200;
  let jsonData: any = null;
  const headers: Record<string, string> = {};
  let ended = false;

  // Bind methods so they can be referenced after overriding
  const originalStatus = function (code: number) {
    statusCode = code;
    return res;
  };

  const originalEnd = function () {
    ended = true;
    return res;
  };

  const res: any = {
    status: originalStatus,
    json: function (data: any) {
      jsonData = data;
      return res;
    },
    set: function (key: string, value: string) {
      headers[key.toLowerCase()] = value;
      return res;
    },
    end: originalEnd,
    get statusCode() {
      return statusCode;
    },
    get data() {
      return jsonData;
    },
    get headers() {
      return headers;
    },
    get isEnded() {
      return ended;
    },
  };

  return res;
}

function createMockNext() {
  const errors: any[] = [];
  return {
    fn: (err?: any) => {
      if (err) errors.push(err);
    },
    get errors() {
      return errors;
    },
  };
}

// Helper to invoke route with middleware
async function invokeRouteWithMiddleware(
  routeStack: any[],
  req: any,
  res: any,
  next: any,
) {
  if (routeStack.length < 2) {
    throw new Error('Route stack does not have middleware and handler');
  }

  const middleware = routeStack[0]?.handle;
  const handler = routeStack[1]?.handle;

  if (!middleware || !handler) {
    throw new Error('Middleware or handler not found');
  }

  await middleware(req, res, async () => {
    await handler(req, res, next);
  });
}

describe('Stats Router - Caching', () => {
  describe('GET /api/stats - Cache headers', () => {
    it('should set Cache-Control header', async () => {
      const mockService = {
        getGlobalStats: async () => ({
          totalProjects: 3,
          totalAgents: 10,
          totalWork: 25,
        }),
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[0]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      expect(res.headers['cache-control']).toBe('max-age=30, must-revalidate');
    });

    it('should set ETag header', async () => {
      const mockService = {
        getGlobalStats: async () => ({
          totalProjects: 3,
          totalAgents: 10,
          totalWork: 25,
        }),
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[0]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      expect(res.headers['etag']).toBeDefined();
      expect(res.headers['etag']).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should generate consistent ETags for identical data', async () => {
      const mockData = {
        totalProjects: 3,
        totalAgents: 10,
        totalWork: 25,
      };

      const mockService = {
        getGlobalStats: async () => mockData,
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[0]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      // First request
      const req1 = createMockRequest();
      const res1 = createMockResponse();
      const next1 = createMockNext();
      await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);

      // Second request with same data
      const req2 = createMockRequest();
      const res2 = createMockResponse();
      const next2 = createMockNext();
      await invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn);

      // ETags should match
      expect(res1.headers['etag']).toBe(res2.headers['etag']);
    });
  });

  describe('GET /api/stats - Conditional requests', () => {
    it('should return 304 Not Modified when ETag matches', async () => {
      // Mock Date.now to ensure consistent timestamps
      const originalDateToISOString = Date.prototype.toISOString;
      const fixedTimestamp = '2024-01-01T00:00:00.000Z';
      Date.prototype.toISOString = () => fixedTimestamp;

      try {
        const mockData = {
          totalProjects: 3,
          totalAgents: 10,
          totalWork: 25,
        };

        const mockService = {
          getGlobalStats: async () => mockData,
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // First request to get ETag
        const req1 = createMockRequest();
        const res1 = createMockResponse();
        const next1 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);

        const etag = res1.headers['etag'];
        expect(etag).toBeDefined();

        // Second request with If-None-Match header
        const req2 = createMockRequest({ 'if-none-match': etag });
        const res2 = createMockResponse();
        const next2 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn);

        // Should return 304
        expect(res2.statusCode).toBe(304);
        expect(res2.isEnded).toBe(true);
        expect(res2.data).toBeNull();
      } finally {
        // Restore original Date.toISOString
        Date.prototype.toISOString = originalDateToISOString;
      }
    });

    it('should return 200 OK when ETag differs', async () => {
      const mockService = {
        getGlobalStats: async () => ({
          totalProjects: 3,
          totalAgents: 10,
          totalWork: 25,
        }),
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[0]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      // Request with wrong ETag
      const req = createMockRequest({ 'if-none-match': '"wrong-etag"' });
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      // Should return full response
      expect(res.statusCode).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.totalProjects).toBe(3);
    });

    it('should return 200 OK when If-None-Match is not present', async () => {
      const mockService = {
        getGlobalStats: async () => ({
          totalProjects: 3,
          totalAgents: 10,
          totalWork: 25,
        }),
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[0]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      expect(res.statusCode).toBe(200);
      expect(res.data).toBeDefined();
    });
  });

  describe('GET /api/stats/projects - Caching', () => {
    it('should set Cache-Control and ETag headers', async () => {
      const mockService = {
        listProjects: () => ['project-1', 'project-2', 'project-3'],
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[1]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      expect(res.headers['cache-control']).toBe('max-age=30, must-revalidate');
      expect(res.headers['etag']).toBeDefined();
      expect(res.headers['etag']).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should return 304 for matching ETag on /projects endpoint', async () => {
      // Mock Date.now to ensure consistent timestamps
      const originalDateToISOString = Date.prototype.toISOString;
      const fixedTimestamp = '2024-01-01T00:00:00.000Z';
      Date.prototype.toISOString = () => fixedTimestamp;

      try {
        const mockService = {
          listProjects: () => ['project-1', 'project-2'],
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[1]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // First request
        const req1 = createMockRequest();
        const res1 = createMockResponse();
        const next1 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);

        const etag = res1.headers['etag'];

        // Second request with matching ETag
        const req2 = createMockRequest({ 'if-none-match': etag });
        const res2 = createMockResponse();
        const next2 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn);

        expect(res2.statusCode).toBe(304);
        expect(res2.isEnded).toBe(true);
      } finally {
        // Restore original Date.toISOString
        Date.prototype.toISOString = originalDateToISOString;
      }
    });
  });

  describe('ETag generation', () => {
    it('should generate different ETags for different data', () => {
      const data1 = { count: 1 };
      const data2 = { count: 2 };

      const etag1 = generateETag(data1);
      const etag2 = generateETag(data2);

      expect(etag1).not.toBe(etag2);
    });

    it('should generate same ETag for same data', () => {
      const data = { count: 1, name: 'test' };

      const etag1 = generateETag(data);
      const etag2 = generateETag(data);

      expect(etag1).toBe(etag2);
    });

    it('should generate ETag in correct format', () => {
      const data = { test: 'data' };
      const etag = generateETag(data);

      // Should be quoted MD5 hash
      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });
  });

  describe('Non-multi-tenant fallback', () => {
    it('should cache single project stats', async () => {
      const mockService = {
        getStats: async () => ({
          agents: 5,
          work: 10,
        }),
      } as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[0]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      expect(res.headers['cache-control']).toBe('max-age=30, must-revalidate');
      expect(res.headers['etag']).toBeDefined();
      expect(res.data.agents).toBe(5);
    });

    it('should cache default projects list', async () => {
      const mockService = {} as any;

      const router = createStatsRouter(mockService);
      const routeStack = router.stack[1]?.route?.stack;
      if (!routeStack) throw new Error('Route stack not found');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

      expect(res.headers['cache-control']).toBe('max-age=30, must-revalidate');
      expect(res.headers['etag']).toBeDefined();
      expect(res.data.projects).toEqual(['default']);
    });
  });

  describe('Advanced Cache Integration Tests', () => {
    describe('ETag changes when data changes', () => {
      it('should generate different ETag when stats change', async () => {
        let callCount = 0;
        const mockService = {
          getGlobalStats: async () => {
            callCount++;
            return {
              totalProjects: callCount, // Changes each call
              totalAgents: 10,
              totalWork: 25,
            };
          },
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // First request
        const req1 = createMockRequest();
        const res1 = createMockResponse();
        const next1 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);
        const etag1 = res1.headers['etag'];

        // Second request - data changes
        const req2 = createMockRequest();
        const res2 = createMockResponse();
        const next2 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn);
        const etag2 = res2.headers['etag'];

        // ETags should be different
        expect(etag1).not.toBe(etag2);
        expect(res1.data.totalProjects).toBe(1);
        expect(res2.data.totalProjects).toBe(2);
      });

      it('should maintain same ETag for identical data', async () => {
        // Mock Date.now to ensure consistent timestamps
        const originalDateToISOString = Date.prototype.toISOString;
        const fixedTimestamp = '2024-01-01T00:00:00.000Z';
        Date.prototype.toISOString = () => fixedTimestamp;

        try {
          const mockService = {
            getGlobalStats: async () => ({
              totalProjects: 5,
              totalAgents: 10,
              totalWork: 25,
            }),
          } as any;

          const router = createStatsRouter(mockService);
          const routeStack = router.stack[0]?.route?.stack;
          if (!routeStack) throw new Error('Route stack not found');

          // Make 5 requests with same data
          const etags: string[] = [];
          for (let i = 0; i < 5; i++) {
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();
            await invokeRouteWithMiddleware(routeStack, req, res, next.fn);
            etags.push(res.headers['etag']);
          }

          // All ETags should be identical
          expect(new Set(etags).size).toBe(1);
        } finally {
          Date.prototype.toISOString = originalDateToISOString;
        }
      });
    });

    describe('Concurrent requests with same ETag', () => {
      it('should handle multiple concurrent requests with same ETag', async () => {
        // Mock Date.now for consistency
        const originalDateToISOString = Date.prototype.toISOString;
        const fixedTimestamp = '2024-01-01T00:00:00.000Z';
        Date.prototype.toISOString = () => fixedTimestamp;

        try {
          const mockService = {
            getGlobalStats: async () => ({
              totalProjects: 3,
              totalAgents: 10,
              totalWork: 25,
            }),
          } as any;

          const router = createStatsRouter(mockService);
          const routeStack = router.stack[0]?.route?.stack;
          if (!routeStack) throw new Error('Route stack not found');

          // Get initial ETag
          const req1 = createMockRequest();
          const res1 = createMockResponse();
          const next1 = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);
          const etag = res1.headers['etag'];

          // Simulate 10 concurrent requests with same ETag
          const requests = Array(10)
            .fill(null)
            .map(async () => {
              const req = createMockRequest({ 'if-none-match': etag });
              const res = createMockResponse();
              const next = createMockNext();
              await invokeRouteWithMiddleware(routeStack, req, res, next.fn);
              return res;
            });

          const results = await Promise.all(requests);

          // All should return 304
          results.forEach((res) => {
            expect(res.statusCode).toBe(304);
            expect(res.isEnded).toBe(true);
            expect(res.data).toBeNull();
          });
        } finally {
          Date.prototype.toISOString = originalDateToISOString;
        }
      });

      it('should handle concurrent requests with different ETags', async () => {
        const mockService = {
          getGlobalStats: async () => ({
            totalProjects: 3,
            totalAgents: 10,
            totalWork: 25,
          }),
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // Simulate requests with different ETags
        const etags = ['"etag1"', '"etag2"', '"etag3"'];
        const requests = etags.map(async (etag) => {
          const req = createMockRequest({ 'if-none-match': etag });
          const res = createMockResponse();
          const next = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req, res, next.fn);
          return res;
        });

        const results = await Promise.all(requests);

        // All should return 200 (wrong ETags)
        results.forEach((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.data).toBeDefined();
          expect(res.data.totalProjects).toBe(3);
        });
      });
    });

    describe('Multiple clients with different ETags', () => {
      it('should handle multiple clients requesting same endpoint', async () => {
        // Mock Date.now for consistency
        const originalDateToISOString = Date.prototype.toISOString;
        const fixedTimestamp = '2024-01-01T00:00:00.000Z';
        Date.prototype.toISOString = () => fixedTimestamp;

        try {
          const mockService = {
            getGlobalStats: async () => ({
              totalProjects: 3,
              totalAgents: 10,
              totalWork: 25,
            }),
          } as any;

          const router = createStatsRouter(mockService);
          const routeStack = router.stack[0]?.route?.stack;
          if (!routeStack) throw new Error('Route stack not found');

          // Client 1: First request (no ETag)
          const req1 = createMockRequest();
          const res1 = createMockResponse();
          const next1 = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);
          const client1Etag = res1.headers['etag'];

          // Client 2: First request (no ETag) - should get same ETag
          const req2 = createMockRequest();
          const res2 = createMockResponse();
          const next2 = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn);
          const client2Etag = res2.headers['etag'];

          expect(client1Etag).toBe(client2Etag);

          // Client 1: Second request (with correct ETag)
          const req3 = createMockRequest({ 'if-none-match': client1Etag });
          const res3 = createMockResponse();
          const next3 = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req3, res3, next3.fn);
          expect(res3.statusCode).toBe(304);

          // Client 2: Second request (with old/wrong ETag)
          const req4 = createMockRequest({ 'if-none-match': '"old-etag"' });
          const res4 = createMockResponse();
          const next4 = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req4, res4, next4.fn);
          expect(res4.statusCode).toBe(200);
          expect(res4.data).toBeDefined();
        } finally {
          Date.prototype.toISOString = originalDateToISOString;
        }
      });
    });

    describe('Cached responses isolation', () => {
      it('should not interfere between different endpoints', async () => {
        // Mock Date.now for consistency
        const originalDateToISOString = Date.prototype.toISOString;
        const fixedTimestamp = '2024-01-01T00:00:00.000Z';
        Date.prototype.toISOString = () => fixedTimestamp;

        try {
          const mockService = {
            getGlobalStats: async () => ({
              totalProjects: 3,
              totalAgents: 10,
              totalWork: 25,
            }),
            listProjects: () => ['project-1', 'project-2', 'project-3'],
          } as any;

          const router = createStatsRouter(mockService);

          // Get ETag from /stats endpoint
          const statsRoute = router.stack[0]?.route?.stack;
          if (!statsRoute) throw new Error('Stats route not found');
          const req1 = createMockRequest();
          const res1 = createMockResponse();
          const next1 = createMockNext();
          await invokeRouteWithMiddleware(statsRoute, req1, res1, next1.fn);
          const statsEtag = res1.headers['etag'];

          // Get ETag from /projects endpoint
          const projectsRoute = router.stack[1]?.route?.stack;
          if (!projectsRoute) throw new Error('Projects route not found');
          const req2 = createMockRequest();
          const res2 = createMockResponse();
          const next2 = createMockNext();
          await invokeRouteWithMiddleware(projectsRoute, req2, res2, next2.fn);
          const projectsEtag = res2.headers['etag'];

          // ETags should be different (different data)
          expect(statsEtag).not.toBe(projectsEtag);

          // Using stats ETag on projects endpoint should fail
          const req3 = createMockRequest({ 'if-none-match': statsEtag });
          const res3 = createMockResponse();
          const next3 = createMockNext();
          await invokeRouteWithMiddleware(projectsRoute, req3, res3, next3.fn);
          expect(res3.statusCode).toBe(200); // Wrong ETag, full response

          // Using correct projects ETag should succeed
          const req4 = createMockRequest({ 'if-none-match': projectsEtag });
          const res4 = createMockResponse();
          const next4 = createMockNext();
          await invokeRouteWithMiddleware(projectsRoute, req4, res4, next4.fn);
          expect(res4.statusCode).toBe(304);
        } finally {
          Date.prototype.toISOString = originalDateToISOString;
        }
      });

      it('should handle response isolation between requests', async () => {
        const mockService = {
          getGlobalStats: async () => ({
            totalProjects: 3,
            totalAgents: 10,
            totalWork: 25,
          }),
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // Make two concurrent requests
        const req1 = createMockRequest();
        const res1 = createMockResponse();
        const next1 = createMockNext();

        const req2 = createMockRequest();
        const res2 = createMockResponse();
        const next2 = createMockNext();

        await Promise.all([
          invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn),
          invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn),
        ]);

        // Both should have their own response data
        expect(res1.data).toBeDefined();
        expect(res2.data).toBeDefined();
        expect(res1.data.totalProjects).toBe(3);
        expect(res2.data.totalProjects).toBe(3);

        // Both should have cache headers
        expect(res1.headers['etag']).toBeDefined();
        expect(res2.headers['etag']).toBeDefined();
        expect(res1.headers['etag']).toBe(res2.headers['etag']);
      });
    });

    describe('Cache bypass and validation', () => {
      it('should not cache responses with different data shapes', async () => {
        let dataVersion = 1;
        const mockService = {
          getGlobalStats: async () => {
            if (dataVersion === 1) {
              return { totalProjects: 3, totalAgents: 10 };
            } else {
              return { totalProjects: 3, totalAgents: 10, totalWork: 25 };
            }
          },
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // First request
        const req1 = createMockRequest();
        const res1 = createMockResponse();
        const next1 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req1, res1, next1.fn);
        const etag1 = res1.headers['etag'];

        // Change data shape
        dataVersion = 2;

        // Second request
        const req2 = createMockRequest();
        const res2 = createMockResponse();
        const next2 = createMockNext();
        await invokeRouteWithMiddleware(routeStack, req2, res2, next2.fn);
        const etag2 = res2.headers['etag'];

        // ETags should be different
        expect(etag1).not.toBe(etag2);
        expect(res1.data.totalWork).toBeUndefined();
        expect(res2.data.totalWork).toBe(25);
      });

      it('should handle empty response data', async () => {
        const mockService = {
          listProjects: () => [],
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[1]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

        // Should still set cache headers
        expect(res.headers['cache-control']).toBe('max-age=30, must-revalidate');
        expect(res.headers['etag']).toBeDefined();
        expect(res.data.projects).toEqual([]);
      });

      it('should handle large response payloads', async () => {
        const largeArray = Array(1000)
          .fill(null)
          .map((_, i) => `project-${i}`);
        const mockService = {
          listProjects: () => largeArray,
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[1]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

        // Should generate valid ETag for large payload
        expect(res.headers['etag']).toBeDefined();
        expect(res.headers['etag']).toMatch(/^"[a-f0-9]{32}"$/);
        expect(res.data.projects.length).toBe(1000);
      });
    });

    describe('ETag format validation', () => {
      it('should always generate RFC 7232 compliant ETags', async () => {
        const mockService = {
          getGlobalStats: async () => ({
            totalProjects: 3,
            totalAgents: 10,
            totalWork: 25,
          }),
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        // Test multiple requests
        for (let i = 0; i < 5; i++) {
          const req = createMockRequest();
          const res = createMockResponse();
          const next = createMockNext();
          await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

          const etag = res.headers['etag'];
          // Must be quoted
          expect(etag.startsWith('"')).toBe(true);
          expect(etag.endsWith('"')).toBe(true);
          // Must be MD5 hash (32 hex chars)
          expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
        }
      });

      it('should handle special characters in data', async () => {
        const mockService = {
          getGlobalStats: async () => ({
            totalProjects: 3,
            specialChars: '!@#$%^&*()_+-={}[]|:;<>?,./~`',
            unicode: '日本語 🎉',
          }),
        } as any;

        const router = createStatsRouter(mockService);
        const routeStack = router.stack[0]?.route?.stack;
        if (!routeStack) throw new Error('Route stack not found');

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await invokeRouteWithMiddleware(routeStack, req, res, next.fn);

        // Should still generate valid ETag
        expect(res.headers['etag']).toBeDefined();
        expect(res.headers['etag']).toMatch(/^"[a-f0-9]{32}"$/);
      });
    });
  });
});
