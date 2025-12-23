/**
 * WebSocket Server
 *
 * Provides real-time updates for agent status, work assignments, and system events
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import type {
  WebSocketServerConfig,
  ExtendedWebSocket,
  WebSocketMessage,
} from './types.js';
import { SubscriptionManager } from './subscriptions.js';
import {
  MessageType,
  type Topic,
  type SubscribeMessage,
  type UnsubscribeMessage,
  type AckMessage,
  type EventMessage,
  type ErrorMessage,
  type PongMessage,
  type StatsMessage,
} from './protocol.js';
import type { CoordinatorEvent } from '@loominal/shared';
import { authenticateWebSocket } from './auth.js';

const DEFAULT_CONFIG: WebSocketServerConfig = {
  path: '/api/ws',
  heartbeatIntervalMs: 30000, // 30 seconds
  heartbeatTimeoutMs: 35000, // 35 seconds (slightly longer than interval)
  statsIntervalMs: 30000, // 30 seconds
};

/**
 * Stats provider function type
 */
export type StatsProvider = () => Promise<{
  agents: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  work: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
  };
  targets: {
    total: number;
    available: number;
    inUse: number;
    disabled: number;
  };
}>;

/**
 * Weft WebSocket Server
 *
 * Manages WebSocket connections for real-time updates
 */
export class WeftWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<string, ExtendedWebSocket> = new Map();
  private subscriptionManager: SubscriptionManager = new SubscriptionManager();
  private heartbeatInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;
  private config: WebSocketServerConfig;
  private statsProvider?: StatsProvider;
  private projectId?: string;

  constructor(
    httpServer: HTTPServer,
    config?: Partial<WebSocketServerConfig>,
    statsProvider?: StatsProvider,
    projectId?: string
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.statsProvider = statsProvider;
    this.projectId = projectId;

    this.wss = new WebSocketServer({
      server: httpServer,
      path: this.config.path,
      verifyClient: (info, callback) => {
        // Skip auth if not required or no tokens configured
        if (!this.config.requireAuth || !this.config.allowedTokens || this.config.allowedTokens.length === 0) {
          callback(true);
          return;
        }

        const result = authenticateWebSocket(
          info.req,
          this.config.allowedTokens
        );

        if (!result.authenticated) {
          console.warn(`WebSocket auth failed: ${result.error}`);
          callback(false, 401, result.error);
          return;
        }

        console.log('WebSocket client authenticated successfully');
        callback(true);
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws as ExtendedWebSocket);
    });

    this.startHeartbeat();
    this.startStatsUpdates();
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: ExtendedWebSocket): void {
    const connectionId = uuidv4();

    // Initialize connection metadata
    ws.metadata = {
      id: connectionId,
      connectedAt: new Date(),
      isAlive: true,
      subscriptions: new Set<string>(),
    };

    this.connections.set(connectionId, ws);

    console.log(`WebSocket client connected: ${connectionId} (total: ${this.connections.size})`);

    // Handle pong responses (heartbeat)
    ws.on('pong', () => {
      ws.metadata.isAlive = true;
      ws.metadata.lastPongAt = new Date();
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        this.handleMessage(connectionId, data);
      } catch (error) {
        console.error(`Error handling WebSocket message from ${connectionId}:`, error);
        this.sendErrorToConnection(connectionId, 'Invalid message format');
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.subscriptionManager.unsubscribeAll(connectionId);
      this.connections.delete(connectionId);
      console.log(`WebSocket client disconnected: ${connectionId} (total: ${this.connections.size})`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${connectionId}:`, error);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(connectionId: string, data: Buffer): void {
    const message = JSON.parse(data.toString()) as any;

    switch (message.type) {
      case 'ping':
        this.handlePing(connectionId);
        break;

      case 'subscribe':
        this.handleSubscribe(connectionId, message as SubscribeMessage);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(connectionId, message as UnsubscribeMessage);
        break;

      default:
        this.sendErrorToConnection(connectionId, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(connectionId: string): void {
    const message: PongMessage = {
      type: MessageType.PONG,
      timestamp: new Date().toISOString(),
    };
    this.sendToConnection(connectionId, message);
  }

  /**
   * Handle subscribe message
   */
  private handleSubscribe(connectionId: string, msg: SubscribeMessage): void {
    this.subscriptionManager.subscribe(connectionId, msg.topic, msg.filter);

    const ack: AckMessage = {
      type: MessageType.ACK,
      subscribed: msg.topic,
      timestamp: new Date().toISOString(),
    };

    this.sendToConnection(connectionId, ack);
    console.log(`Client ${connectionId} subscribed to ${msg.topic}${msg.filter ? ' (filtered)' : ''}`);
  }

  /**
   * Handle unsubscribe message
   */
  private handleUnsubscribe(connectionId: string, msg: UnsubscribeMessage): void {
    const success = this.subscriptionManager.unsubscribe(connectionId, msg.topic);

    if (success) {
      const ack: AckMessage = {
        type: MessageType.ACK,
        unsubscribed: msg.topic,
        timestamp: new Date().toISOString(),
      };

      this.sendToConnection(connectionId, ack);
      console.log(`Client ${connectionId} unsubscribed from ${msg.topic}`);
    } else {
      this.sendErrorToConnection(connectionId, `Not subscribed to topic: ${msg.topic}`);
    }
  }

  /**
   * Send message to a specific WebSocket client by connection ID
   */
  private sendToConnection(connectionId: string, message: any): void {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to a specific client
   */
  private sendErrorToConnection(connectionId: string, errorMessage: string): void {
    const error: ErrorMessage = {
      type: MessageType.ERROR,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
    this.sendToConnection(connectionId, error);
  }

  /**
   * Start heartbeat mechanism
   *
   * Sends ping frames every 30 seconds and terminates dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((ws, connectionId) => {
        // Terminate connections that didn't respond to previous ping
        if (!ws.metadata.isAlive) {
          console.log(`Terminating dead WebSocket connection: ${connectionId}`);
          this.subscriptionManager.unsubscribeAll(connectionId);
          ws.terminate();
          this.connections.delete(connectionId);
          return;
        }

        // Mark as not alive and send ping
        ws.metadata.isAlive = false;
        ws.metadata.lastPingAt = new Date();
        ws.ping();
      });
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Start periodic stats updates
   *
   * Sends stats to all subscribed clients every 30 seconds
   */
  private startStatsUpdates(): void {
    this.statsInterval = setInterval(async () => {
      if (!this.statsProvider) {
        return;
      }

      const subscribers = this.subscriptionManager.getStatsSubscribers();
      if (subscribers.length === 0) {
        return;
      }

      try {
        const stats = await this.statsProvider();

        const message: StatsMessage = {
          type: MessageType.STATS,
          data: {
            ...stats,
            websocket: {
              connections: this.connections.size,
              subscriptions: this.subscriptionManager.getTotalSubscriptions(),
            },
          },
          timestamp: new Date().toISOString(),
          projectId: this.projectId,
        };

        subscribers.forEach(connectionId => {
          this.sendToConnection(connectionId, message);
        });
      } catch (error) {
        console.error('Error sending stats updates:', error);
      }
    }, this.config.statsIntervalMs);
  }

  /**
   * Broadcast coordinator event to subscribed clients
   */
  public broadcastEvent(topic: Topic, event: CoordinatorEvent): void {
    const subscribers = this.subscriptionManager.getSubscribers(topic, event);

    if (subscribers.length === 0) {
      return;
    }

    const message: EventMessage = {
      type: MessageType.EVENT,
      topic,
      event: event.type,
      data: event,
      timestamp: event.timestamp,
      projectId: event.projectId,
    };

    subscribers.forEach(connectionId => {
      this.sendToConnection(connectionId, message);
    });
  }

  /**
   * Broadcast message to all connected clients (legacy)
   */
  public broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify(message);

    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Broadcast message to clients subscribed to a specific topic (legacy)
   */
  public broadcastToSubscribers(topic: string, message: WebSocketMessage): void {
    const payload = JSON.stringify(message);

    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.metadata.subscriptions.has(topic)) {
        ws.send(payload);
      }
    });
  }

  /**
   * Get current connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    connections: number;
    status: string;
  } {
    return {
      connections: this.connections.size,
      status: 'ok',
    };
  }

  /**
   * Gracefully shutdown WebSocket server
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket server...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Stop stats updates
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }

    // Clear all subscriptions
    this.connections.forEach((_ws, connectionId) => {
      this.subscriptionManager.unsubscribeAll(connectionId);
    });

    // Close all connections
    const closePromises: Promise<void>[] = [];

    this.connections.forEach((ws) => {
      closePromises.push(
        new Promise<void>((resolve) => {
          ws.on('close', () => resolve());
          ws.close(1001, 'Server shutting down');

          // Force close after timeout
          setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
              ws.terminate();
            }
            resolve();
          }, 5000);
        })
      );
    });

    await Promise.all(closePromises);
    this.connections.clear();

    // Close WebSocket server
    return new Promise<void>((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log('WebSocket server closed');
          resolve();
        }
      });
    });
  }
}
