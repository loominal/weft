/**
 * WebSocket Authentication Tests
 *
 * Tests bearer token authentication for WebSocket connections
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server as HTTPServer } from 'http';
import WebSocket from 'ws';
import { WeftWebSocketServer } from '../server.js';
import type { WebSocketServerConfig } from '../types.js';

describe('WebSocket Authentication', () => {
  let httpServer: HTTPServer;
  let wsServer: WeftWebSocketServer;
  let port: number;
  const validToken = 'test-secret-token';
  const anotherValidToken = 'another-test-token';
  const invalidToken = 'invalid-token';

  /**
   * Helper to create a WebSocket client
   */
  function createClient(options?: {
    queryToken?: string;
    protocols?: string[];
  }): Promise<{ ws: WebSocket; error?: { statusCode: number; message: string } }> {
    return new Promise((resolve, reject) => {
      const url = options?.queryToken
        ? `ws://localhost:${port}/api/ws?token=${options.queryToken}`
        : `ws://localhost:${port}/api/ws`;

      const ws = new WebSocket(url, options?.protocols);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 2000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve({ ws });
      });

      ws.on('error', (error: any) => {
        clearTimeout(timeout);
        // WebSocket library wraps HTTP errors
        if (error.message?.includes('401')) {
          resolve({
            ws,
            error: {
              statusCode: 401,
              message: error.message
            }
          });
        } else {
          reject(error);
        }
      });

      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timeout);
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({
            ws,
            error: {
              statusCode: res.statusCode!,
              message: body || res.statusMessage || 'Unauthorized'
            }
          });
        });
      });
    });
  }

  /**
   * Test: Auth disabled when no tokens configured
   */
  it('should allow connections when auth is disabled (no tokens)', async () => {
    // Setup server with no tokens
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: false,
      allowedTokens: []
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Should connect without token
    const { ws, error } = await createClient();
    expect(error).toBeUndefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Valid token via query parameter
   */
  it('should accept valid token via query parameter', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken, anotherValidToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Connect with valid token
    const { ws, error } = await createClient({ queryToken: validToken });
    expect(error).toBeUndefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Valid token via Sec-WebSocket-Protocol header
   */
  it('should accept valid token via Sec-WebSocket-Protocol header', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken, anotherValidToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Connect with valid token in protocol header
    const { ws, error } = await createClient({ protocols: ['bearer', validToken] });
    expect(error).toBeUndefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Invalid token rejection via query parameter
   */
  it('should reject invalid token via query parameter', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Attempt connection with invalid token
    const { ws, error } = await createClient({ queryToken: invalidToken });
    expect(error).toBeDefined();
    expect(error?.statusCode).toBe(401);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Invalid token rejection via protocol header
   */
  it('should reject invalid token via Sec-WebSocket-Protocol header', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Attempt connection with invalid token
    const { ws, error } = await createClient({ protocols: ['bearer', invalidToken] });
    expect(error).toBeDefined();
    expect(error?.statusCode).toBe(401);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Missing token rejection
   */
  it('should reject connection with no token when auth is required', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Attempt connection without token
    const { ws, error } = await createClient();
    expect(error).toBeDefined();
    expect(error?.statusCode).toBe(401);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Multiple valid tokens
   */
  it('should accept any token from allowedTokens list', async () => {
    // Setup server with multiple tokens
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken, anotherValidToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Connect with first token
    const { ws: ws1, error: error1 } = await createClient({ queryToken: validToken });
    expect(error1).toBeUndefined();
    expect(ws1.readyState).toBe(WebSocket.OPEN);

    // Connect with second token
    const { ws: ws2, error: error2 } = await createClient({ queryToken: anotherValidToken });
    expect(error2).toBeUndefined();
    expect(ws2.readyState).toBe(WebSocket.OPEN);

    ws1.close();
    ws2.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Authenticated client can subscribe to topics
   */
  it('should allow authenticated client to subscribe to topics', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Connect with valid token
    const { ws, error } = await createClient({ queryToken: validToken });
    expect(error).toBeUndefined();

    // Subscribe to a topic
    const subscribePromise = new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'ack' && message.subscribed === 'agents') {
          resolve(message);
        }
      });
    });

    ws.send(JSON.stringify({
      type: 'subscribe',
      topic: 'agents'
    }));

    const ackMessage = await subscribePromise;
    expect(ackMessage).toBeDefined();
    expect((ackMessage as any).subscribed).toBe('agents');

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Query parameter takes precedence over protocol header
   */
  it('should prioritize query parameter token over protocol header', async () => {
    // Setup server with auth enabled
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Connect with valid query token and invalid protocol token
    const { ws, error } = await createClient({
      queryToken: validToken,
      protocols: ['bearer', invalidToken]
    });
    expect(error).toBeUndefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await wsServer.shutdown();
    httpServer.close();
  });

  /**
   * Test: Production mode enables auth by default
   */
  it('should require auth when requireAuth is true', async () => {
    // Setup server with explicit requireAuth
    const app = express();
    httpServer = app.listen(0);
    port = (httpServer.address() as any).port;

    const config: Partial<WebSocketServerConfig> = {
      requireAuth: true,
      allowedTokens: [validToken]
    };

    wsServer = new WeftWebSocketServer(httpServer, config);

    // Should reject without token
    const { ws: ws1, error: error1 } = await createClient();
    expect(error1).toBeDefined();
    expect(error1?.statusCode).toBe(401);

    // Should accept with token
    const { ws: ws2, error: error2 } = await createClient({ queryToken: validToken });
    expect(error2).toBeUndefined();
    expect(ws2.readyState).toBe(WebSocket.OPEN);

    ws1.close();
    ws2.close();
    await wsServer.shutdown();
    httpServer.close();
  });
});
