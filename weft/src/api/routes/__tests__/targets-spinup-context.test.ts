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

describe('Targets Router - Spin-Up Context', () => {
  describe('GET /api/targets - Spin-Up Context', () => {
    it('should include lastSpinUp in target response when available', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        status: 'available',
        lastSpinUp: {
          time: '2025-12-23T10:00:00Z',
          outcome: 'success',
          workItemId: 'work-123',
        },
      };

      const mockService = {
        listTargets: async () => ({
          items: [mockTarget],
          total: 1,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0].route.stack[0].handle;

      const req = createMockRequest({});
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.targets).toBeDefined();
      expect(responseData.targets[0].lastSpinUp).toBeDefined();
      expect(responseData.targets[0].lastSpinUp.time).toBe('2025-12-23T10:00:00Z');
      expect(responseData.targets[0].lastSpinUp.outcome).toBe('success');
      expect(responseData.targets[0].lastSpinUp.workItemId).toBe('work-123');
    });

    it('should include agent details in lastSpinUp when available', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        status: 'available',
        lastSpinUp: {
          time: '2025-12-23T10:00:00Z',
          outcome: 'success',
          agent: {
            guid: 'agent-123',
            handle: 'dev-agent-1',
            agentType: 'claude-code',
            hostname: 'laptop.local',
          },
        },
      };

      const mockService = {
        listTargets: async () => ({
          items: [mockTarget],
          total: 1,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0].route.stack[0].handle;

      const req = createMockRequest({});
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.targets[0].lastSpinUp.agent).toBeDefined();
      expect(responseData.targets[0].lastSpinUp.agent.guid).toBe('agent-123');
      expect(responseData.targets[0].lastSpinUp.agent.handle).toBe('dev-agent-1');
      expect(responseData.targets[0].lastSpinUp.agent.agentType).toBe('claude-code');
    });

    it('should work when lastSpinUp is not present', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        status: 'available',
        // No lastSpinUp
      };

      const mockService = {
        listTargets: async () => ({
          items: [mockTarget],
          total: 1,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0].route.stack[0].handle;

      const req = createMockRequest({});
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.targets).toBeDefined();
      expect(responseData.targets[0].lastSpinUp).toBeUndefined();
    });

    it('should include error message in lastSpinUp when outcome is failure', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        status: 'error',
        lastSpinUp: {
          time: '2025-12-23T10:00:00Z',
          outcome: 'failure',
          error: 'Connection timeout',
        },
      };

      const mockService = {
        listTargets: async () => ({
          items: [mockTarget],
          total: 1,
        }),
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[0].route.stack[0].handle;

      const req = createMockRequest({});
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.targets[0].lastSpinUp.outcome).toBe('failure');
      expect(responseData.targets[0].lastSpinUp.error).toBe('Connection timeout');
    });
  });

  describe('GET /api/targets/:id - Spin-Up Context', () => {
    it('should include lastSpinUp in single target response', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        status: 'available',
        lastSpinUp: {
          time: '2025-12-23T10:00:00Z',
          outcome: 'success',
          workItemId: 'work-123',
          agent: {
            guid: 'agent-123',
            handle: 'dev-agent-1',
            agentType: 'claude-code',
          },
        },
      };

      const mockService = {
        getTarget: async () => mockTarget,
      } as any;

      const router = createTargetsRouter(mockService);
      // GET /:id is the second route
      const handler = router.stack[1].route.stack[0].handle;

      const req = { params: { id: 'target-1' } };
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.lastSpinUp).toBeDefined();
      expect(responseData.lastSpinUp.time).toBe('2025-12-23T10:00:00Z');
      expect(responseData.lastSpinUp.outcome).toBe('success');
      expect(responseData.lastSpinUp.agent).toBeDefined();
    });

    it('should work when target has no lastSpinUp', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        status: 'available',
        // No lastSpinUp
      };

      const mockService = {
        getTarget: async () => mockTarget,
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[1].route.stack[0].handle;

      const req = { params: { id: 'target-1' } };
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      expect(responseData.id).toBe('target-1');
      expect(responseData.lastSpinUp).toBeUndefined();
    });

    it('should match TargetResponse type structure', async () => {
      let responseData: any;

      const mockTarget = {
        id: 'target-1',
        name: 'test-target',
        agentType: 'claude-code',
        capabilities: ['typescript', 'python'],
        boundaries: ['personal', 'open-source'],
        mechanism: 'local',
        status: 'available',
        lastSpinUp: {
          time: '2025-12-23T10:00:00Z',
          outcome: 'success',
          agent: {
            guid: 'agent-123',
            handle: 'dev-agent',
            agentType: 'claude-code',
            hostname: 'laptop.local',
          },
          workItemId: 'work-123',
        },
      };

      const mockService = {
        getTarget: async () => mockTarget,
      } as any;

      const router = createTargetsRouter(mockService);
      const handler = router.stack[1].route.stack[0].handle;

      const req = { params: { id: 'target-1' } };
      const res = {
        ...createMockResponse(),
        json: function(data: any) {
          responseData = data;
          return this;
        },
      };
      const next = () => {};

      await handler(req, res, next);

      // Verify TargetResponse structure
      expect(responseData).toBeDefined();
      expect(responseData.id).toBeDefined();
      expect(responseData.name).toBeDefined();
      expect(responseData.agentType).toBeDefined();
      expect(responseData.capabilities).toBeDefined();
      expect(responseData.boundaries).toBeDefined();
      expect(responseData.mechanism).toBeDefined();
      expect(responseData.status).toBeDefined();

      // Verify SpinUpEvent structure
      expect(responseData.lastSpinUp).toBeDefined();
      expect(responseData.lastSpinUp.time).toBeDefined();
      expect(responseData.lastSpinUp.outcome).toBeDefined();
      expect(responseData.lastSpinUp.agent).toBeDefined();
      expect(responseData.lastSpinUp.workItemId).toBeDefined();

      // Verify AgentSummary structure
      expect(responseData.lastSpinUp.agent.guid).toBeDefined();
      expect(responseData.lastSpinUp.agent.agentType).toBeDefined();
    });
  });
});
