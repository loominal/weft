import { Router } from 'express';
import type { WorkSubmitRequest, BatchCancelWorkRequest } from '@loominal/shared';
import type { CoordinatorServiceLayer } from '../server.js';
import { APIError } from '../middleware/error.js';
import { v4 as uuidv4 } from 'uuid';
import {
  parsePaginationQuery,
  createPaginationMetadata,
  createFilterHash,
  validateCursor,
} from '../../utils/pagination.js';

/**
 * Validates boundary (user-defined, just needs to be non-empty string)
 */
function isValidBoundary(boundary: string): boolean {
  return typeof boundary === 'string' && boundary.trim().length > 0;
}

/**
 * Validates priority (1-10)
 */
function isValidPriority(priority: unknown): boolean {
  return (
    typeof priority === 'number' &&
    Number.isInteger(priority) &&
    priority >= 1 &&
    priority <= 10
  );
}

/**
 * Creates the work router
 */
export function createWorkRouter(service: CoordinatorServiceLayer): Router {
  const router = Router();

  /**
   * GET /api/work
   * List pending/active work items
   *
   * Query parameters:
   * - status: Filter by status (pending, assigned, in-progress, completed, failed, cancelled)
   * - boundary: Filter by boundary/classification
   * - classification: (Deprecated) Use boundary instead
   * - cursor: Pagination cursor for continuing a paginated query
   * - limit: Maximum number of items to return (default: 50, max: 100)
   *
   * Deprecation: 'classification' parameter is deprecated. Use 'boundary' instead.
   * Both parameters are accepted for backward compatibility.
   */
  router.get('/', async (req, res, next) => {
    try {
      const { status, boundary, classification, cursor, limit } = req.query;

      const filter: {
        status?: string;
        boundary?: string;
      } = {};

      if (status && typeof status === 'string') {
        filter.status = status;
      }

      // Support both 'boundary' and 'classification' parameters
      // Prefer 'boundary', fall back to 'classification'
      const boundaryValue = (boundary || classification) as string | undefined;
      if (boundaryValue && typeof boundaryValue === 'string') {
        filter.boundary = boundaryValue;

        // Add deprecation header if old param was used
        if (classification && !boundary) {
          res.setHeader(
            'X-Deprecated-Param',
            'classification (use boundary instead)',
          );
        }
      }

      // Parse pagination parameters
      const pagination = parsePaginationQuery({
        cursor: cursor as string | undefined,
        limit: limit as string | undefined,
      }, 50, 100);

      // Validate cursor if provided
      if (cursor) {
        const filterHash = createFilterHash(filter);
        const validation = validateCursor(cursor as string, filterHash);
        if (!validation.valid) {
          throw new APIError(400, validation.error || 'Invalid pagination cursor');
        }
      }

      // Add pagination to filter
      const workItems = await service.listWork({
        ...filter,
        offset: pagination.offset,
        limit: pagination.limit,
      });

      // Create pagination metadata
      const filterHash = createFilterHash(filter);
      const metadata = createPaginationMetadata({
        count: workItems.length,
        offset: pagination.offset,
        limit: pagination.limit,
        filterHash,
      });

      res.json({
        workItems,
        count: metadata.count,
        total: metadata.total,
        hasMore: metadata.hasMore,
        nextCursor: metadata.nextCursor,
        prevCursor: metadata.prevCursor,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/work
   * Submit new work item
   *
   * Body: WorkSubmitRequest
   */
  router.post('/', async (req, res, next) => {
    try {
      const request = req.body as Partial<WorkSubmitRequest>;

      // Auto-generate taskId if not provided
      if (!request.taskId) {
        request.taskId = uuidv4();
      }

      // Validate required fields
      if (!request.boundary) {
        throw new APIError(400, 'classification is required');
      }
      if (!request.capability) {
        throw new APIError(400, 'capability is required');
      }
      if (!request.description) {
        throw new APIError(400, 'description is required');
      }

      // Validate boundary (user-defined)
      if (!isValidBoundary(request.boundary)) {
        throw new APIError(400, 'boundary must be a non-empty string');
      }

      // Validate priority if provided
      if (request.priority !== undefined && !isValidPriority(request.priority)) {
        throw new APIError(
          400,
          'priority must be an integer between 1 and 10',
        );
      }

      // Validate agent types if provided
      if (request.preferredAgentType) {
        if (!['copilot-cli', 'claude-code'].includes(request.preferredAgentType)) {
          throw new APIError(
            400,
            `Invalid preferredAgentType: ${request.preferredAgentType}. Must be copilot-cli or claude-code`,
          );
        }
      }
      if (request.requiredAgentType) {
        if (!['copilot-cli', 'claude-code'].includes(request.requiredAgentType)) {
          throw new APIError(
            400,
            `Invalid requiredAgentType: ${request.requiredAgentType}. Must be copilot-cli or claude-code`,
          );
        }
      }

      const result = await service.submitWork(request);

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/work/:id
   * Get work item status
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new APIError(400, 'Work item ID is required');
      }

      const workItem = await service.getWorkItem(id);

      if (!workItem) {
        throw new APIError(404, `Work item with ID ${id} not found`);
      }

      res.json(workItem);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/work/:id/cancel
   * Cancel work item
   */
  router.post('/:id/cancel', async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new APIError(400, 'Work item ID is required');
      }

      // Verify work item exists
      const workItem = await service.getWorkItem(id);
      if (!workItem) {
        throw new APIError(404, `Work item with ID ${id} not found`);
      }

      await service.cancelWorkItem(id);

      res.json({
        success: true,
        message: `Work item ${id} cancelled`,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/work/cancel-batch
   * Batch cancel work items
   *
   * Body: BatchCancelWorkRequest
   * - filter: Filter criteria for selecting work items (alternative to workItemIds)
   *   - status: Filter by work status
   *   - boundary: Filter by boundary
   *   - capability: Filter by capability
   *   - minPriority: Filter by minimum priority
   *   - assignedTo: Filter by assigned agent GUID
   * - workItemIds: Specific work item IDs to cancel (alternative to filter)
   * - reason: Reason for cancellation (user-requested, deadline-passed, resource-constraint, system-shutdown)
   * - reassign: Whether to reassign cancelled work to other agents (default: false)
   */
  router.post('/cancel-batch', async (req, res, next) => {
    try {
      const request = req.body as Partial<BatchCancelWorkRequest>;

      // Validate request - must have either filter or workItemIds
      if (!request.filter && !request.workItemIds) {
        throw new APIError(400, 'Either filter or workItemIds must be provided');
      }

      if (request.workItemIds && !Array.isArray(request.workItemIds)) {
        throw new APIError(400, 'workItemIds must be an array');
      }

      if (request.filter) {
        // Validate filter fields
        if (request.filter.status && typeof request.filter.status !== 'string') {
          throw new APIError(400, 'filter.status must be a string');
        }
        if (request.filter.boundary && typeof request.filter.boundary !== 'string') {
          throw new APIError(400, 'filter.boundary must be a string');
        }
        if (request.filter.capability && typeof request.filter.capability !== 'string') {
          throw new APIError(400, 'filter.capability must be a string');
        }
        if (request.filter.minPriority !== undefined && typeof request.filter.minPriority !== 'number') {
          throw new APIError(400, 'filter.minPriority must be a number');
        }
        if (request.filter.assignedTo && typeof request.filter.assignedTo !== 'string') {
          throw new APIError(400, 'filter.assignedTo must be a string');
        }
      }

      if (request.reason && !['user-requested', 'deadline-passed', 'resource-constraint', 'system-shutdown'].includes(request.reason)) {
        throw new APIError(400, 'Invalid reason. Must be one of: user-requested, deadline-passed, resource-constraint, system-shutdown');
      }

      const result = await service.batchCancelWork(request);

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
