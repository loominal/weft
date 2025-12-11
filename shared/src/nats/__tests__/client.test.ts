/**
 * Tests for NATS URL parsing
 */

import { describe, it, expect } from 'vitest';
import { parseNatsUrl } from '../client.js';

describe('parseNatsUrl', () => {
  describe('URLs without authentication', () => {
    it('should parse simple nats URL', () => {
      const result = parseNatsUrl('nats://localhost:4222');
      expect(result).toEqual({
        server: 'nats://localhost:4222',
      });
    });

    it('should parse URL with hostname', () => {
      const result = parseNatsUrl('nats://nats.example.com:4222');
      expect(result).toEqual({
        server: 'nats://nats.example.com:4222',
      });
    });

    it('should parse URL without port', () => {
      const result = parseNatsUrl('nats://localhost');
      expect(result).toEqual({
        server: 'nats://localhost',
      });
    });

    it('should handle IP address', () => {
      const result = parseNatsUrl('nats://192.168.1.100:4222');
      expect(result).toEqual({
        server: 'nats://192.168.1.100:4222',
      });
    });
  });

  describe('URLs with authentication', () => {
    it('should parse URL with user and password', () => {
      const result = parseNatsUrl('nats://myuser:mypass@localhost:4222');
      expect(result).toEqual({
        server: 'nats://localhost:4222',
        user: 'myuser',
        pass: 'mypass',
      });
    });

    it('should parse URL with user only', () => {
      const result = parseNatsUrl('nats://myuser@localhost:4222');
      expect(result).toEqual({
        server: 'nats://localhost:4222',
        user: 'myuser',
      });
    });

    it('should handle URL-encoded credentials', () => {
      const result = parseNatsUrl('nats://user%40domain:p%40ss%2Fword@localhost:4222');
      expect(result).toEqual({
        server: 'nats://localhost:4222',
        user: 'user@domain',
        pass: 'p@ss/word',
      });
    });

    it('should handle password with special characters', () => {
      const result = parseNatsUrl('nats://agent:FxZWmPIV6rzDC4i6xuk9AEJ9Kd5sMpFi58%2FOAtr7INQ%3D@nats.example.com:4222');
      expect(result).toEqual({
        server: 'nats://nats.example.com:4222',
        user: 'agent',
        pass: 'FxZWmPIV6rzDC4i6xuk9AEJ9Kd5sMpFi58/OAtr7INQ=',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle invalid URL gracefully', () => {
      const result = parseNatsUrl('not-a-valid-url');
      expect(result).toEqual({
        server: 'not-a-valid-url',
      });
    });

    it('should handle empty string', () => {
      const result = parseNatsUrl('');
      expect(result).toEqual({
        server: '',
      });
    });

    it('should handle URL with empty password (no pass returned)', () => {
      // Empty password results in no pass property
      const result = parseNatsUrl('nats://user:@localhost:4222');
      expect(result).toEqual({
        server: 'nats://localhost:4222',
        user: 'user',
      });
    });
  });
});
