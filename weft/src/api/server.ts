import express, { type Express } from 'express';
import cors from 'cors';
import * as OpenApiValidator from 'express-openapi-validator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Server as HTTPServer } from 'http';
import type { APIConfiguration, PaginationState } from '@loominal/shared';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { WeftWebSocketServer } from './websocket/index.js';

// Import route handlers (will be created)
import { createAgentsRouter } from './routes/agents.js';
import { createWorkRouter } from './routes/work.js';
import { createStatsRouter } from './routes/stats.js';
import { createTargetsRouter } from './routes/targets.js';
import { createChannelsRouter } from './routes/channels.js';
import { createDocsRouter } from './routes/docs.js';

/**
 * Service layer interface
 *
 * This is a stub interface that routes will use to interact with
 * the coordinator business logic. Other streams will implement these.
 */
export interface CoordinatorServiceLayer {
  // Agent operations
  listAgents(filter?: {
    agentType?: string;
    status?: string;
    capability?: string;
    offset?: number;
    limit?: number;
    filterHash?: string;
  }): Promise<{ agents: unknown[]; total?: number }>;

  getAgent(guid: string): Promise<unknown | null>;

  requestAgentShutdown(guid: string, graceful: boolean): Promise<void>;

  // Work operations
  listWork(filter?: {
    status?: string;
    boundary?: string;
    offset?: number;
    limit?: number;
  }): Promise<unknown[]>;

  submitWork(request: unknown): Promise<unknown>;

  getWorkItem(id: string): Promise<unknown | null>;

  cancelWorkItem(id: string): Promise<void>;

  // Stats operations
  getStats(): Promise<{
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

  // Target operations
  listTargets(
    filter?: {
      agentType?: string;
      status?: string;
      capability?: string;
      boundary?: string;
    },
    pagination?: PaginationState
  ): Promise<{ items: unknown[]; total?: number }>;

  getTarget(idOrName: string): Promise<unknown | null>;

  registerTarget(request: unknown): Promise<unknown>;

  updateTarget(idOrName: string, updates: unknown): Promise<unknown>;

  removeTarget(idOrName: string): Promise<void>;

  testTargetHealth(idOrName: string): Promise<unknown>;

  triggerTargetSpinUp(idOrName: string): Promise<unknown>;

  disableTarget(idOrName: string): Promise<void>;

  enableTarget(idOrName: string): Promise<void>;

  // Channel operations
  listChannels(projectId: string): Promise<{ name: string; description?: string }[]>;

  readChannelMessages(
    projectId: string,
    channelName: string,
    limit: number
  ): Promise<{ timestamp: string; handle: string; message: string }[]>;

  // Batch operations
  batchShutdownAgents(request: unknown): Promise<unknown>;

  batchDisableTargets(request: unknown): Promise<unknown>;

  batchCancelWork(request: unknown): Promise<unknown>;
}

/**
 * Creates and configures the Express application
 */
export function createExpressApp(
  config: APIConfiguration,
  serviceLayer: CoordinatorServiceLayer,
): Express {
  const app = express();

  // Store WebSocket server reference for health endpoint
  let wsServer: WeftWebSocketServer | null = null;

  // Expose method to set WebSocket server (called after HTTP server starts)
  (app as any).setWebSocketServer = (ws: WeftWebSocketServer) => {
    wsServer = ws;
  };

  // Basic middleware
  app.use(express.json());

  // CORS configuration
  const corsOptions = config.corsOrigins
    ? { origin: config.corsOrigins }
    : {};
  app.use(cors(corsOptions));

  // Get the path to the OpenAPI spec file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const apiSpecPath = join(__dirname, 'openapi.yaml');

  // Documentation routes (no auth required for public docs)
  // Must come BEFORE OpenAPI validator and authentication middleware
  app.use('/api', createDocsRouter());

  // OpenAPI validation middleware
  // This MUST come before route handlers to validate requests/responses
  // But AFTER documentation routes to avoid validating them
  app.use(
    OpenApiValidator.middleware({
      apiSpec: apiSpecPath,
      validateRequests: true, // Validate incoming requests (400 on invalid)
      validateResponses: true, // Validate outgoing responses (catch implementation bugs)
      validateSecurity: false, // We handle bearer tokens separately
      validateApiSpec: true, // Validate the spec itself on startup
      ignorePaths: /\/api\/(docs|openapi\.json)/, // Don't validate documentation routes
    }),
  );

  // Authentication middleware (if tokens configured)
  // Applied to all /api routes except docs
  const authMiddleware = createAuthMiddleware(config.authTokens);
  app.use('/api', authMiddleware);

  // API routes
  app.use('/api/agents', createAgentsRouter(serviceLayer));
  app.use('/api/work', createWorkRouter(serviceLayer));
  app.use('/api/stats', createStatsRouter(serviceLayer));
  app.use('/api/targets', createTargetsRouter(serviceLayer));
  app.use('/api/channels', createChannelsRouter(serviceLayer));

  // Health check endpoint (no auth required)
  app.get('/health', (_req, res) => {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      documentation: '/api/docs'
    };

    // Include WebSocket stats if available
    if (wsServer) {
      health.websocket = wsServer.getStats();
    }

    res.json(health);
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Server context returned by startServer
 */
export interface ServerContext {
  httpServer: HTTPServer;
  wsServer: WeftWebSocketServer;
  shutdown: () => Promise<void>;
}

/**
 * Starts the Express server with WebSocket support
 */
export async function startServer(
  app: Express,
  config: APIConfiguration,
  serviceLayer?: CoordinatorServiceLayer,
  projectId?: string
): Promise<ServerContext> {
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(config.port, config.host, () => {
      console.log(`API server listening on http://${config.host}:${config.port}`);

      // Create stats provider if service layer is available
      const statsProvider = serviceLayer
        ? async () => {
            const stats = await serviceLayer.getStats();
            return stats;
          }
        : undefined;

      // Initialize WebSocket server with auth config
      const wsConfig = {
        requireAuth: config.authTokens && config.authTokens.length > 0,
        allowedTokens: config.authTokens || []
      };

      const wsServer = new WeftWebSocketServer(
        httpServer,
        wsConfig,
        statsProvider,
        projectId
      );
      console.log(`WebSocket server listening on ws://${config.host}:${config.port}/api/ws`);

      // Register WebSocket server with app for health endpoint
      (app as any).setWebSocketServer(wsServer);

      // Create shutdown function
      const shutdown = async () => {
        console.log('Shutting down servers...');

        // Shutdown WebSocket server first
        await wsServer.shutdown();

        // Shutdown HTTP server
        return new Promise<void>((resolve, reject) => {
          httpServer.close((error) => {
            if (error) {
              reject(error);
            } else {
              console.log('HTTP server closed');
              resolve();
            }
          });
        });
      };

      resolve({ httpServer, wsServer, shutdown });
    });

    httpServer.on('error', reject);
  });
}
