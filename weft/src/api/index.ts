/**
 * REST API module for the coordinator service
 *
 * This module provides a REST API for interacting with the coordinator,
 * including agent management, work submission, statistics, and target
 * management endpoints.
 */

// Server and service layer
export { createExpressApp, startServer } from './server.js';
export type { CoordinatorServiceLayer, ServerContext } from './server.js';

// WebSocket server
export { WeftWebSocketServer } from './websocket/index.js';
export type { WebSocketMessage, WebSocketMessageType, WebSocketServerConfig } from './websocket/index.js';

// Middleware
export { createAuthMiddleware } from './middleware/auth.js';
export { errorHandler, notFoundHandler, APIError } from './middleware/error.js';
export type { ErrorResponse } from './middleware/error.js';

// Route handlers
export { createAgentsRouter } from './routes/agents.js';
export { createWorkRouter } from './routes/work.js';
export { createStatsRouter } from './routes/stats.js';
export { createTargetsRouter } from './routes/targets.js';
