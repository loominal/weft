/**
 * Tests for Copilot Bridge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopilotBridge } from './bridge.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock @loom/shared
vi.mock('@loom/shared', () => ({
  createNATSClient: vi.fn(),
  WorkSubjects: {
    queue: (projectId: string, capability: string) => `loom.${projectId}.work.queue.${capability}`,
    completed: (projectId: string) => `loom.${projectId}.work.completed`,
    errors: (projectId: string) => `loom.${projectId}.work.errors`,
  },
  AgentSubjects: {
    register: (projectId: string) => `loom.${projectId}.agent.register`,
    deregister: (projectId: string) => `loom.${projectId}.agent.deregister`,
  },
  KVBuckets: {
    agentRegistry: (projectId: string) => `loom-agents-${projectId}`,
  },
  encodeMessage: (data: unknown) => new TextEncoder().encode(JSON.stringify(data)),
  decodeMessage: (data: Uint8Array) => JSON.parse(new TextDecoder().decode(data)),
}));

// Mock config module
vi.mock('./config.js', () => ({
  loadConfig: vi.fn(),
  printConfig: vi.fn(),
}));

// Mock target-registration module
vi.mock('./target-registration.js', () => ({
  registerSelfAsTarget: vi.fn(),
  linkAgentToTarget: vi.fn(),
  unlinkAgentFromTarget: vi.fn(),
}));

import { spawn } from 'child_process';
import { createNATSClient } from '@loom/shared';
import { loadConfig, printConfig } from './config.js';
import {
  registerSelfAsTarget,
  linkAgentToTarget,
  unlinkAgentFromTarget,
} from './target-registration.js';
import type { BridgeConfig } from './config.js';

describe('CopilotBridge', () => {
  const mockConfig: BridgeConfig = {
    natsUrl: 'nats://localhost:4222',
    projectId: 'test-project',
    agentHandle: 'test-agent',
    capabilities: ['general', 'typescript'],
    boundaries: ['default', 'personal'],
    idleTimeoutMs: 0, // Disable for tests
    registerTarget: false,
    maxConcurrent: 1,
    copilotPath: 'copilot',
    workingDirectory: '/tmp',
    copilotEnv: {},
  };

  let mockKV: {
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  let mockClient: {
    nc: {
      subscribe: ReturnType<typeof vi.fn>;
      publish: ReturnType<typeof vi.fn>;
    };
    js: {
      views: {
        kv: ReturnType<typeof vi.fn>;
      };
    };
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock KV store
    mockKV = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        value: new TextEncoder().encode(JSON.stringify({
          guid: 'test-guid',
          handle: 'test-agent',
          status: 'online',
        })),
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock NATS client
    mockClient = {
      nc: {
        subscribe: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({ done: true }),
          }),
        }),
        publish: vi.fn().mockResolvedValue(undefined),
      },
      js: {
        views: {
          kv: vi.fn().mockResolvedValue(mockKV),
        },
      },
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(loadConfig).mockReturnValue(mockConfig);
    vi.mocked(createNATSClient).mockResolvedValue(mockClient as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should load config on construction', () => {
      new CopilotBridge();
      expect(loadConfig).toHaveBeenCalled();
    });

    it('should pass config path to loadConfig', () => {
      new CopilotBridge('/custom/config.json');
      expect(loadConfig).toHaveBeenCalledWith('/custom/config.json');
    });
  });

  describe('start', () => {
    it('should connect to NATS', async () => {
      const bridge = new CopilotBridge();

      // Start will set up intervals, so we need to mock process.on
      const originalOn = process.on;
      process.on = vi.fn() as any;

      await bridge.start();

      expect(createNATSClient).toHaveBeenCalledWith({
        url: 'nats://localhost:4222',
        name: 'copilot-bridge-test-agent',
      });

      process.on = originalOn;
    });

    it('should print config', async () => {
      const bridge = new CopilotBridge();

      const originalOn = process.on;
      process.on = vi.fn() as any;

      await bridge.start();

      expect(printConfig).toHaveBeenCalledWith(mockConfig);

      process.on = originalOn;
    });

    it('should register as agent', async () => {
      const bridge = new CopilotBridge();

      const originalOn = process.on;
      process.on = vi.fn() as any;

      await bridge.start();

      // Should put agent entry in KV store
      expect(mockKV.put).toHaveBeenCalled();

      // Should publish registration announcement
      expect(mockClient.nc.publish).toHaveBeenCalledWith(
        'loom.test-project.agent.register',
        expect.any(Uint8Array)
      );

      process.on = originalOn;
    });

    it('should subscribe to work queues for all capabilities', async () => {
      const bridge = new CopilotBridge();

      const originalOn = process.on;
      process.on = vi.fn() as any;

      await bridge.start();

      // Should subscribe to work queue for each capability
      expect(mockClient.nc.subscribe).toHaveBeenCalledWith('loom.test-project.work.queue.general');
      expect(mockClient.nc.subscribe).toHaveBeenCalledWith('loom.test-project.work.queue.typescript');

      process.on = originalOn;
    });

    it('should register target when configured', async () => {
      const configWithTarget: BridgeConfig = {
        ...mockConfig,
        registerTarget: true,
        targetName: 'my-target',
      };
      vi.mocked(loadConfig).mockReturnValue(configWithTarget);

      const bridge = new CopilotBridge();

      const originalOn = process.on;
      process.on = vi.fn() as any;

      await bridge.start();

      expect(registerSelfAsTarget).toHaveBeenCalled();

      process.on = originalOn;
    });

    it('should link to target when target name is provided', async () => {
      const configWithTarget: BridgeConfig = {
        ...mockConfig,
        targetName: 'my-target',
      };
      vi.mocked(loadConfig).mockReturnValue(configWithTarget);

      const bridge = new CopilotBridge();

      const originalOn = process.on;
      process.on = vi.fn() as any;

      await bridge.start();

      expect(linkAgentToTarget).toHaveBeenCalledWith(
        expect.anything(), // client
        'test-project',
        'my-target',
        expect.any(String) // guid
      );

      process.on = originalOn;
    });
  });

  describe('shutdown', () => {
    it('should update agent status to offline', async () => {
      const bridge = new CopilotBridge();

      const originalOn = process.on;
      const originalExit = process.exit;
      process.on = vi.fn() as any;
      process.exit = vi.fn() as any;

      await bridge.start();
      await bridge.shutdown('manual');

      // Should update status in KV
      expect(mockKV.put).toHaveBeenCalled();

      process.on = originalOn;
      process.exit = originalExit;
    });

    it('should deregister agent', async () => {
      const bridge = new CopilotBridge();

      const originalOn = process.on;
      const originalExit = process.exit;
      process.on = vi.fn() as any;
      process.exit = vi.fn() as any;

      await bridge.start();
      await bridge.shutdown('manual');

      // Should delete agent from KV
      expect(mockKV.delete).toHaveBeenCalled();

      // Should publish deregister announcement
      expect(mockClient.nc.publish).toHaveBeenCalledWith(
        'loom.test-project.agent.deregister',
        expect.any(Uint8Array)
      );

      process.on = originalOn;
      process.exit = originalExit;
    });

    it('should close NATS connection', async () => {
      const bridge = new CopilotBridge();

      const originalOn = process.on;
      const originalExit = process.exit;
      process.on = vi.fn() as any;
      process.exit = vi.fn() as any;

      await bridge.start();
      await bridge.shutdown('manual');

      expect(mockClient.close).toHaveBeenCalled();

      process.on = originalOn;
      process.exit = originalExit;
    });

    it('should unlink from target when configured', async () => {
      const configWithTarget: BridgeConfig = {
        ...mockConfig,
        targetName: 'my-target',
      };
      vi.mocked(loadConfig).mockReturnValue(configWithTarget);

      const bridge = new CopilotBridge();

      const originalOn = process.on;
      const originalExit = process.exit;
      process.on = vi.fn() as any;
      process.exit = vi.fn() as any;

      await bridge.start();
      await bridge.shutdown('manual');

      expect(unlinkAgentFromTarget).toHaveBeenCalledWith(
        expect.anything(), // client
        'test-project',
        'my-target'
      );

      process.on = originalOn;
      process.exit = originalExit;
    });
  });
});
