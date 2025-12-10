/**
 * Tests for configuration file management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  listConfig,
  validateConfig,
  getDefaultConfigPath,
} from '../utils/config-file.js';

// Create a temp directory for tests
const TEST_DIR = join(tmpdir(), `loom-test-${Date.now()}`);
const TEST_CONFIG = join(TEST_DIR, 'config.json');

describe('Config File', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NATS_URL;
    delete process.env.PROJECT_ID;
    delete process.env.LOOM_API_URL;
    delete process.env.LOOM_API_TOKEN;

    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up test config
    if (existsSync(TEST_CONFIG)) {
      unlinkSync(TEST_CONFIG);
    }
  });

  describe('loadConfig', () => {
    it('should return default values when no config exists', () => {
      const config = loadConfig(join(TEST_DIR, 'nonexistent.json'));

      expect(config.projectId).toBe('default');
      expect(config.natsUrl).toBe('nats://localhost:4222');
    });

    it('should load config from file', () => {
      writeFileSync(
        TEST_CONFIG,
        JSON.stringify({
          natsUrl: 'nats://custom:4222',
          projectId: 'my-project',
        })
      );

      const config = loadConfig(TEST_CONFIG);

      expect(config.natsUrl).toBe('nats://custom:4222');
      expect(config.projectId).toBe('my-project');
    });

    it('should override file config with environment variables', () => {
      writeFileSync(
        TEST_CONFIG,
        JSON.stringify({
          natsUrl: 'nats://file:4222',
          projectId: 'file-project',
        })
      );

      process.env.NATS_URL = 'nats://env:4222';
      process.env.PROJECT_ID = 'env-project';

      const config = loadConfig(TEST_CONFIG);

      expect(config.natsUrl).toBe('nats://env:4222');
      expect(config.projectId).toBe('env-project');
    });

    it('should accept project override via options', () => {
      writeFileSync(
        TEST_CONFIG,
        JSON.stringify({
          projectId: 'file-project',
        })
      );

      const config = loadConfig({
        configPath: TEST_CONFIG,
        projectOverride: 'override-project',
      });

      expect(config.projectId).toBe('override-project');
    });

    it('should prioritize project override over environment', () => {
      process.env.PROJECT_ID = 'env-project';

      const config = loadConfig({
        configPath: TEST_CONFIG,
        projectOverride: 'override-project',
      });

      expect(config.projectId).toBe('override-project');
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', () => {
      saveConfig({ natsUrl: 'nats://saved:4222', projectId: 'saved-project' }, TEST_CONFIG);

      const content = readFileSync(TEST_CONFIG, 'utf-8');
      const config = JSON.parse(content);

      expect(config.natsUrl).toBe('nats://saved:4222');
      expect(config.projectId).toBe('saved-project');
    });

    it('should merge with existing config', () => {
      writeFileSync(
        TEST_CONFIG,
        JSON.stringify({
          natsUrl: 'nats://existing:4222',
          projectId: 'existing-project',
        })
      );

      saveConfig({ projectId: 'updated-project' }, TEST_CONFIG);

      const content = readFileSync(TEST_CONFIG, 'utf-8');
      const config = JSON.parse(content);

      expect(config.natsUrl).toBe('nats://existing:4222');
      expect(config.projectId).toBe('updated-project');
    });
  });

  describe('getConfigValue', () => {
    it('should get specific config value', () => {
      writeFileSync(
        TEST_CONFIG,
        JSON.stringify({
          projectId: 'test-project',
        })
      );

      const value = getConfigValue('projectId', TEST_CONFIG);
      expect(value).toBe('test-project');
    });
  });

  describe('setConfigValue', () => {
    it('should set specific config value', () => {
      setConfigValue('projectId', 'new-project', TEST_CONFIG);

      const content = readFileSync(TEST_CONFIG, 'utf-8');
      const config = JSON.parse(content);

      expect(config.projectId).toBe('new-project');
    });
  });

  describe('listConfig', () => {
    it('should list all config values', () => {
      writeFileSync(
        TEST_CONFIG,
        JSON.stringify({
          natsUrl: 'nats://list:4222',
          projectId: 'list-project',
        })
      );

      const config = listConfig(TEST_CONFIG);

      expect(config.natsUrl).toBe('nats://list:4222');
      expect(config.projectId).toBe('list-project');
    });
  });

  describe('validateConfig', () => {
    it('should accept valid config', () => {
      const errors = validateConfig({
        natsUrl: 'nats://localhost:4222',
        defaultPriority: 5,
        defaultBoundary: 'personal',
        outputFormat: 'table',
      });

      expect(errors).toHaveLength(0);
    });

    it('should reject invalid natsUrl', () => {
      const errors = validateConfig({
        natsUrl: 'http://localhost:4222',
      });

      expect(errors).toContain('natsUrl must start with nats://');
    });

    it('should reject invalid priority', () => {
      const errors = validateConfig({
        defaultPriority: 15,
      });

      expect(errors).toContain('defaultPriority must be between 1 and 10');
    });

    it('should reject empty boundary', () => {
      const errors = validateConfig({
        defaultBoundary: '   ',
      });

      expect(errors).toContain('defaultBoundary must be a non-empty string');
    });

    it('should reject invalid output format', () => {
      const errors = validateConfig({
        outputFormat: 'xml' as any,
      });

      expect(errors).toContain('outputFormat must be either "table" or "json"');
    });
  });

  describe('getDefaultConfigPath', () => {
    it('should return path containing .loom', () => {
      const path = getDefaultConfigPath();
      expect(path).toContain('.loom');
      expect(path).toContain('config.json');
    });
  });
});
