/**
 * WebSocket Protocol
 *
 * Defines the subscription protocol for real-time event streaming.
 * Clients can subscribe to topics (agents, work, targets, stats) with optional filters.
 */

import type { CoordinatorEventType } from '@loominal/shared';

/**
 * WebSocket message types for subscription protocol
 */
export enum MessageType {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  PING = 'ping',

  // Server -> Client
  ACK = 'ack',
  EVENT = 'event',
  STATS = 'stats',
  ERROR = 'error',
  PONG = 'pong',
}

/**
 * Subscription topics
 */
export enum Topic {
  AGENTS = 'agents',
  WORK = 'work',
  TARGETS = 'targets',
  STATS = 'stats',
}

/**
 * Filter for work events
 */
export interface WorkFilter {
  /** Filter by work status */
  status?: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  /** Filter by capability */
  capability?: string;
  /** Filter by boundary */
  boundary?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Filter by assigned agent GUID */
  assignedTo?: string;
}

/**
 * Filter for agent events
 */
export interface AgentFilter {
  /** Filter by agent type */
  agentType?: string;
  /** Filter by agent status */
  status?: 'online' | 'busy' | 'offline';
  /** Filter by capability */
  capability?: string;
  /** Filter by boundary */
  boundary?: string;
  /** Filter by agent GUID */
  guid?: string;
}

/**
 * Filter for target events
 */
export interface TargetFilter {
  /** Filter by agent type */
  agentType?: string;
  /** Filter by target status */
  status?: 'available' | 'in-use' | 'disabled';
  /** Filter by capability */
  capability?: string;
  /** Filter by boundary */
  boundary?: string;
  /** Filter by mechanism */
  mechanism?: string;
  /** Filter by target ID */
  targetId?: string;
}

/**
 * Union of all filter types
 */
export type EventFilter = WorkFilter | AgentFilter | TargetFilter | Record<string, never>;

/**
 * Subscribe message
 * Client sends this to subscribe to a topic
 */
export interface SubscribeMessage {
  type: MessageType.SUBSCRIBE;
  topic: Topic;
  filter?: EventFilter;
}

/**
 * Unsubscribe message
 * Client sends this to unsubscribe from a topic
 */
export interface UnsubscribeMessage {
  type: MessageType.UNSUBSCRIBE;
  topic: Topic;
}

/**
 * Ping message
 * Client can send this to check connection
 */
export interface PingMessage {
  type: MessageType.PING;
}

/**
 * Acknowledgement message
 * Server sends this to confirm subscription/unsubscription
 */
export interface AckMessage {
  type: MessageType.ACK;
  subscribed?: Topic;
  unsubscribed?: Topic;
  timestamp: string;
}

/**
 * Event message
 * Server sends this when an event occurs
 */
export interface EventMessage {
  type: MessageType.EVENT;
  topic: Topic;
  event: CoordinatorEventType | string;
  data: any;
  timestamp: string;
  projectId?: string;
}

/**
 * Stats message
 * Server sends this periodically with system statistics
 */
export interface StatsMessage {
  type: MessageType.STATS;
  data: {
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
    websocket?: {
      connections: number;
      subscriptions: number;
    };
  };
  timestamp: string;
  projectId?: string;
}

/**
 * Error message
 * Server sends this when an error occurs
 */
export interface ErrorMessage {
  type: MessageType.ERROR;
  error: string;
  timestamp: string;
}

/**
 * Pong message
 * Server sends this in response to ping
 */
export interface PongMessage {
  type: MessageType.PONG;
  timestamp: string;
}

/**
 * Union of all message types
 */
export type WebSocketProtocolMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage
  | AckMessage
  | EventMessage
  | StatsMessage
  | ErrorMessage
  | PongMessage;

/**
 * Map coordinator event types to topics
 */
export function eventTypeToTopic(eventType: CoordinatorEventType): Topic {
  if (eventType.startsWith('agent:')) {
    return Topic.AGENTS;
  }
  if (eventType.startsWith('work:')) {
    return Topic.WORK;
  }
  if (eventType.startsWith('target:') || eventType.startsWith('spin-up:')) {
    return Topic.TARGETS;
  }
  // Default to work for unknown types
  return Topic.WORK;
}

/**
 * Validate message type
 */
export function isValidMessageType(type: string): type is MessageType {
  return Object.values(MessageType).includes(type as MessageType);
}

/**
 * Validate topic
 */
export function isValidTopic(topic: string): topic is Topic {
  return Object.values(Topic).includes(topic as Topic);
}
