import { Router } from 'express';
import type { CoordinatorServiceLayer } from '../server.js';
import type { BatchShutdownRequest } from '@loominal/shared';
import { APIError } from '../middleware/error.js';
import { parsePaginationQuery, createPaginationMetadata, createFilterHash, validateCursor } from '../../utils/pagination.js';

/**
 * Creates the agents router
 */
export function createAgentsRouter(service: CoordinatorServiceLayer): Router {
  const router = Router();

  /**
   * GET /api/agents
   * List registered agents
   *
   * Query parameters:
   * - type: Filter by agent type (copilot-cli, claude-code)
   * - status: Filter by status (online, busy, offline)
   * - capability: Filter by capability
   * - cursor: Pagination cursor (optional)
   * - limit: Page size (default: 50, max: 100)
   */
  router.get('/', async (req, res, next) => {
    try {
      const { type, status, capability, cursor, limit } = req.query;

      const filter: {
        agentType?: string;
        status?: string;
        capability?: string;
      } = {};

      if (type && typeof type === 'string') {
        filter.agentType = type;
      }
      if (status && typeof status === 'string') {
        filter.status = status;
      }
      if (capability && typeof capability === 'string') {
        filter.capability = capability;
      }

      // Parse pagination parameters
      const pagination = parsePaginationQuery({
        cursor: cursor as string | undefined,
        limit: limit as string | undefined,
      });

      // Create filter hash for cursor validation
      const filterHash = createFilterHash(filter);

      // Validate cursor if provided
      if (cursor) {
        const validation = validateCursor(cursor as string, filterHash);
        if (!validation.valid) {
          throw new APIError(400, validation.error || 'Invalid pagination cursor');
        }
      }

      // Add pagination to filter
      const paginatedFilter = { ...filter, ...pagination, filterHash };

      const result = await service.listAgents(paginatedFilter);

      // Create pagination metadata
      const metadata = createPaginationMetadata({
        count: result.agents.length,
        total: result.total,
        offset: pagination.offset,
        limit: pagination.limit,
        filterHash,
      });

      res.json({
        agents: result.agents,
        ...metadata,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/agents/:guid
   * Get agent details
   */
  router.get('/:guid', async (req, res, next) => {
    try {
      const { guid } = req.params;

      if (!guid) {
        throw new APIError(400, 'Agent GUID is required');
      }

      const agent = await service.getAgent(guid);

      if (!agent) {
        throw new APIError(404, `Agent with GUID ${guid} not found`);
      }

      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/agents/:guid/shutdown
   * Request agent shutdown
   *
   * Body:
   * - graceful: boolean (optional, default: true) - Wait for current work to complete
   */
  router.post('/:guid/shutdown', async (req, res, next) => {
    try {
      const { guid } = req.params;
      const { graceful = true } = req.body;

      if (!guid) {
        throw new APIError(400, 'Agent GUID is required');
      }

      // Verify agent exists
      const agent = await service.getAgent(guid);
      if (!agent) {
        throw new APIError(404, `Agent with GUID ${guid} not found`);
      }

      await service.requestAgentShutdown(guid, graceful);

      res.json({
        success: true,
        message: `Shutdown request sent to agent ${guid}`,
        graceful,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/agents/shutdown-batch
   * Batch shutdown agents
   *
   * Body: BatchShutdownRequest
   * - filter: Filter criteria for selecting agents (alternative to agentGuids)
   *   - status: Filter by agent status
   *   - idleTimeMs: Filter by idle time threshold
   *   - agentType: Filter by agent type
   *   - boundary: Filter by boundary
   *   - capability: Filter by capability
   * - agentGuids: Specific agent GUIDs to shutdown (alternative to filter)
   * - graceful: Whether to perform graceful shutdown (default: true)
   * - gracePeriodMs: Grace period in ms if graceful (default: 30000)
   * - reason: Reason for shutdown (manual, scaling-down, maintenance, error)
   */
  router.post('/shutdown-batch', async (req, res, next) => {
    try {
      const request = req.body as Partial<BatchShutdownRequest>;

      // Validate request - must have either filter or agentGuids
      if (!request.filter && !request.agentGuids) {
        throw new APIError(400, 'Either filter or agentGuids must be provided');
      }

      if (request.agentGuids && !Array.isArray(request.agentGuids)) {
        throw new APIError(400, 'agentGuids must be an array');
      }

      if (request.filter) {
        // Validate filter fields
        if (request.filter.status && typeof request.filter.status !== 'string') {
          throw new APIError(400, 'filter.status must be a string');
        }
        if (request.filter.idleTimeMs !== undefined && typeof request.filter.idleTimeMs !== 'number') {
          throw new APIError(400, 'filter.idleTimeMs must be a number');
        }
        if (request.filter.agentType && !['copilot-cli', 'claude-code'].includes(request.filter.agentType)) {
          throw new APIError(400, 'filter.agentType must be copilot-cli or claude-code');
        }
      }

      const result = await service.batchShutdownAgents(request);

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
