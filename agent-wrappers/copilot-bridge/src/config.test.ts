/**
 * Tests for Copilot Bridge configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, printConfig, type BridgeConfig } from './config.js';

describe('Copilot Bridge Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear all relevant env vars
    delete process.env.NATS_URL;
    delete process.env.LOOM_PROJECT_ID;
    delete process.env.AGENT_HANDLE;
    delete process.env.AGENT_CAPABILITIES;
    delete process.env.AGENT_CLASSIFICATIONS;
    delete process.env.IDLE_TIMEOUT_MS;
    delete process.env.TARGET_NAME;
    delete process.env.REGISTER_TARGET;
    delete process.env.MAX_CONCURRENT;
    delete process.env.COPILOT_PATH;
    delete process.env.WORK_DIR;
    delete process.env.COPILOT_AGENT;
    delete process.env.COPILOT_BRIDGE_CONFIG;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should require NATS_URL', () => {
      process.env.LOOM_PROJECT_ID = 'test-project';
      process.env.AGENT_HANDLE = 'test-agent';

      expect(() => loadConfig()).toThrow('NATS_URL is required');
    });

    it('should require LOOM_PROJECT_ID', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.AGENT_HANDLE = 'test-agent';

      expect(() => loadConfig()).toThrow('LOOM_PROJECT_ID is required');
    });

    it('should use default AGENT_HANDLE from hostname if not provided', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.LOOM_PROJECT_ID = 'test-project';
      // Clear the handle - should use default
      delete process.env.AGENT_HANDLE;

      const config = loadConfig();

      // Default handle includes hostname
      expect(config.agentHandle).toMatch(/^copilot-agent-/);
    });

    it('should load config from environment variables', () => {
      process.env.NATS_URL = 'nats://test:4222';
      process.env.LOOM_PROJECT_ID = 'my-project';
      process.env.AGENT_HANDLE = 'my-agent';
      process.env.AGENT_CAPABILITIES = 'typescript,python,testing';
      process.env.AGENT_CLASSIFICATIONS = 'personal,open-source';
      process.env.IDLE_TIMEOUT_MS = '600000';
      process.env.MAX_CONCURRENT = '3';
      process.env.COPILOT_PATH = '/usr/bin/copilot';
      process.env.WORK_DIR = '/tmp/work';
      process.env.COPILOT_AGENT = '@workspace';

      const config = loadConfig();

      expect(config.natsUrl).toBe('nats://test:4222');
      expect(config.projectId).toBe('my-project');
      expect(config.agentHandle).toBe('my-agent');
      expect(config.capabilities).toEqual(['typescript', 'python', 'testing']);
      expect(config.boundaries).toEqual(['personal', 'open-source']);
      expect(config.idleTimeoutMs).toBe(600000);
      expect(config.maxConcurrent).toBe(3);
      expect(config.copilotPath).toBe('/usr/bin/copilot');
      expect(config.workingDirectory).toBe('/tmp/work');
      expect(config.copilotAgent).toBe('@workspace');
    });

    it('should use defaults for optional values', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.LOOM_PROJECT_ID = 'test-project';
      process.env.AGENT_HANDLE = 'test-agent';

      const config = loadConfig();

      expect(config.capabilities).toEqual(['general']);
      expect(config.boundaries).toEqual(['default']);
      expect(config.idleTimeoutMs).toBe(300000); // 5 minutes
      expect(config.maxConcurrent).toBe(1);
      expect(config.copilotPath).toBe('copilot');
      expect(config.registerTarget).toBe(false);
    });

    it('should parse boolean REGISTER_TARGET correctly', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.LOOM_PROJECT_ID = 'test-project';
      process.env.AGENT_HANDLE = 'test-agent';
      process.env.REGISTER_TARGET = 'true';
      process.env.TARGET_NAME = 'my-target';

      const config = loadConfig();

      expect(config.registerTarget).toBe(true);
      expect(config.targetName).toBe('my-target');
    });

    it('should require TARGET_NAME when REGISTER_TARGET is true', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.LOOM_PROJECT_ID = 'test-project';
      process.env.AGENT_HANDLE = 'test-agent';
      process.env.REGISTER_TARGET = 'true';
      // No TARGET_NAME

      expect(() => loadConfig()).toThrow('TARGET_NAME is required when REGISTER_TARGET is true');
    });

    it('should load COPILOT_ENV_ prefixed variables', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.LOOM_PROJECT_ID = 'test-project';
      process.env.AGENT_HANDLE = 'test-agent';
      process.env.COPILOT_ENV_GITHUB_TOKEN = 'secret-token';
      process.env.COPILOT_ENV_API_KEY = 'api-key-123';

      const config = loadConfig();

      expect(config.copilotEnv).toEqual({
        GITHUB_TOKEN: 'secret-token',
        API_KEY: 'api-key-123',
      });
    });

    it('should trim whitespace from capabilities list', () => {
      process.env.NATS_URL = 'nats://localhost:4222';
      process.env.LOOM_PROJECT_ID = 'test-project';
      process.env.AGENT_HANDLE = 'test-agent';
      process.env.AGENT_CAPABILITIES = '  typescript , python  ,  testing  ';

      const config = loadConfig();

      expect(config.capabilities).toEqual(['typescript', 'python', 'testing']);
    });
  });

  describe('printConfig', () => {
    it('should print config without throwing', () => {
      const config: BridgeConfig = {
        natsUrl: 'nats://localhost:4222',
        projectId: 'test-project',
        agentHandle: 'test-agent',
        capabilities: ['general'],
        boundaries: ['default'],
        idleTimeoutMs: 300000,
        registerTarget: false,
        maxConcurrent: 1,
        copilotPath: 'copilot',
        workingDirectory: '/tmp',
        copilotEnv: {},
      };

      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      printConfig(config);

      console.log = originalLog;

      expect(logs.some(l => l.includes('NATS URL: nats://localhost:4222'))).toBe(true);
      expect(logs.some(l => l.includes('Project ID: test-project'))).toBe(true);
      expect(logs.some(l => l.includes('Agent Handle: test-agent'))).toBe(true);
    });

    it('should show copilot agent when configured', () => {
      const config: BridgeConfig = {
        natsUrl: 'nats://localhost:4222',
        projectId: 'test-project',
        agentHandle: 'test-agent',
        capabilities: ['general'],
        boundaries: ['default'],
        idleTimeoutMs: 300000,
        registerTarget: false,
        maxConcurrent: 1,
        copilotPath: 'copilot',
        workingDirectory: '/tmp',
        copilotEnv: {},
        copilotAgent: '@workspace',
      };

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      printConfig(config);

      console.log = originalLog;

      expect(logs.some(l => l.includes('Copilot Agent: @workspace'))).toBe(true);
    });
  });
});
