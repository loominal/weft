/**
 * WebSocket Module
 *
 * Exports WebSocket server and types
 */

export { WeftWebSocketServer } from './server.js';
export type {
  WebSocketMessage,
  WebSocketMessageType,
  ConnectionMetadata,
  ExtendedWebSocket,
  WebSocketServerConfig,
} from './types.js';
export { WebSocketMessageType as MessageType } from './types.js';
