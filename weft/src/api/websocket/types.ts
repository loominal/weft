/**
 * WebSocket Server Types
 *
 * Type definitions for WebSocket messaging and connection management
 */

import type { WebSocket } from 'ws';

/**
 * WebSocket message types
 */
export enum WebSocketMessageType {
  // Client -> Server
  PING = 'ping',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',

  // Server -> Client
  PONG = 'pong',
  AGENT_UPDATE = 'agent_update',
  WORK_UPDATE = 'work_update',
  ERROR = 'error',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
}

/**
 * Base WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp: string;
  data?: unknown;
}

/**
 * Connection metadata
 */
export interface ConnectionMetadata {
  id: string;
  connectedAt: Date;
  lastPingAt?: Date;
  lastPongAt?: Date;
  isAlive: boolean;
  subscriptions: Set<string>;
}

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  path: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  statsIntervalMs: number;
  requireAuth?: boolean;
  allowedTokens?: string[];
}

/**
 * Extended WebSocket with metadata
 */
export interface ExtendedWebSocket extends WebSocket {
  metadata: ConnectionMetadata;
}
