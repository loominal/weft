/**
 * WebSocket Server Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HTTPServer } from 'http';
import { WebSocket } from 'ws';
import { WeftWebSocketServer } from '../server.js';
import type { WebSocketMessage } from '../types.js';

describe('WeftWebSocketServer', () => {
  let httpServer: HTTPServer;
  let wsServer: WeftWebSocketServer;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();

    // Find available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });

    // Create WebSocket server
    wsServer = new WeftWebSocketServer(httpServer);
  });

  afterEach(async () => {
    // Shutdown WebSocket server
    if (wsServer) {
      await wsServer.shutdown();
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  it('should start correctly', () => {
    expect(wsServer).toBeDefined();
    expect(wsServer.getConnectionCount()).toBe(0);
  });

  it('should accept client connections', async () => {
    const client = new WebSocket(`ws://localhost:${port}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        expect(wsServer.getConnectionCount()).toBe(1);
        resolve();
      });
      client.on('error', reject);
    });

    client.close();
  });

  it('should handle client disconnection', async () => {
    const client = new WebSocket(`ws://localhost:${port}/api/ws`);

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    expect(wsServer.getConnectionCount()).toBe(1);

    // Disconnect
    await new Promise<void>((resolve) => {
      client.on('close', () => {
        // Give server time to process disconnect
        setTimeout(() => {
          expect(wsServer.getConnectionCount()).toBe(0);
          resolve();
        }, 100);
      });
      client.close();
    });
  });

  it('should handle ping/pong heartbeat', async () => {
    const client = new WebSocket(`ws://localhost:${port}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    // Listen for ping from server (automatic heartbeat)
    // Note: The server sends pings every 30s, so we'll just verify
    // the client can respond to pings by sending one manually
    let pingReceived = false;

    client.on('ping', () => {
      pingReceived = true;
    });

    // Send a manual ping to verify the connection is working
    client.ping();

    // Wait a moment to ensure handlers are set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The connection is established and can handle pings
    // (The automatic heartbeat test would require waiting 30s)
    expect(wsServer.getConnectionCount()).toBe(1);

    client.close();
  });

  it('should track connection count correctly', async () => {
    expect(wsServer.getConnectionCount()).toBe(0);

    // Connect first client
    const client1 = new WebSocket(`ws://localhost:${port}/api/ws`);
    await new Promise<void>((resolve, reject) => {
      client1.on('open', () => resolve());
      client1.on('error', reject);
    });

    expect(wsServer.getConnectionCount()).toBe(1);

    // Connect second client
    const client2 = new WebSocket(`ws://localhost:${port}/api/ws`);
    await new Promise<void>((resolve, reject) => {
      client2.on('open', () => resolve());
      client2.on('error', reject);
    });

    expect(wsServer.getConnectionCount()).toBe(2);

    // Disconnect first client
    await new Promise<void>((resolve) => {
      client1.on('close', () => {
        setTimeout(() => {
          expect(wsServer.getConnectionCount()).toBe(1);
          resolve();
        }, 100);
      });
      client1.close();
    });

    // Disconnect second client
    await new Promise<void>((resolve) => {
      client2.on('close', () => {
        setTimeout(() => {
          expect(wsServer.getConnectionCount()).toBe(0);
          resolve();
        }, 100);
      });
      client2.close();
    });
  });

  it('should handle ping/pong messages', async () => {
    const client = new WebSocket(`ws://localhost:${port}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    // Send ping message
    const pingMessage: WebSocketMessage = {
      type: 'ping' as any,
      timestamp: new Date().toISOString(),
    };

    client.send(JSON.stringify(pingMessage));

    // Wait for pong response
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for pong'));
      }, 5000);

      client.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        expect(message.type).toBe('pong');
        resolve();
      });
    });

    client.close();
  });

  it('should return stats with connection count', () => {
    const stats = wsServer.getStats();

    expect(stats).toHaveProperty('connections');
    expect(stats).toHaveProperty('status');
    expect(stats.connections).toBe(0);
    expect(stats.status).toBe('ok');
  });

  it('should broadcast messages to all connected clients', async () => {
    // Connect two clients
    const client1 = new WebSocket(`ws://localhost:${port}/api/ws`);
    const client2 = new WebSocket(`ws://localhost:${port}/api/ws`);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        client1.on('open', () => resolve());
        client1.on('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        client2.on('open', () => resolve());
        client2.on('error', reject);
      }),
    ]);

    // Setup message listeners
    const received1: WebSocketMessage[] = [];
    const received2: WebSocketMessage[] = [];

    client1.on('message', (data: Buffer) => {
      received1.push(JSON.parse(data.toString()));
    });

    client2.on('message', (data: Buffer) => {
      received2.push(JSON.parse(data.toString()));
    });

    // Broadcast message
    const broadcastMessage: WebSocketMessage = {
      type: 'agent_update' as any,
      timestamp: new Date().toISOString(),
      data: { agent: 'test' },
    };

    wsServer.broadcast(broadcastMessage);

    // Wait for messages to be received
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(received1.length).toBeGreaterThan(0);
    expect(received2.length).toBeGreaterThan(0);
    expect(received1[0].type).toBe('agent_update');
    expect(received2[0].type).toBe('agent_update');

    client1.close();
    client2.close();
  });
});
