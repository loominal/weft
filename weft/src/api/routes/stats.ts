import { Router } from 'express';
import type { CoordinatorServiceLayer } from '../server.js';
import { cacheMiddleware } from '../middleware/cache.js';

/**
 * Extended service layer with multi-tenant methods
 */
interface MultiTenantServiceLayer extends CoordinatorServiceLayer {
  getGlobalStats?: () => Promise<any>;
  listProjects?: () => string[];
}

/**
 * Creates the stats router
 */
export function createStatsRouter(service: CoordinatorServiceLayer): Router {
  const router = Router();
  const multiTenantService = service as MultiTenantServiceLayer;

  /**
   * GET /api/stats
   * Get global statistics across all projects (multi-tenant)
   * or default project stats if not multi-tenant
   *
   * Returns:
   * - Total projects
   * - Aggregate totals
   * - Per-project breakdown
   */
  router.get('/', cacheMiddleware(30), async (_req, res, next) => {
    try {
      // If multi-tenant mode, return global stats
      if (multiTenantService.getGlobalStats) {
        const globalStats = await multiTenantService.getGlobalStats();
        res.json({
          timestamp: new Date().toISOString(),
          ...globalStats,
        });
      } else {
        // Fallback to single project stats
        const stats = await service.getStats();
        res.json({
          timestamp: new Date().toISOString(),
          ...stats,
        });
      }
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/stats/projects
   * List all active projects
   */
  router.get('/projects', cacheMiddleware(30), async (_req, res, next) => {
    try {
      if (multiTenantService.listProjects) {
        const projects = multiTenantService.listProjects();
        res.json({
          timestamp: new Date().toISOString(),
          projects,
          count: projects.length,
        });
      } else {
        res.json({
          timestamp: new Date().toISOString(),
          projects: ['default'],
          count: 1,
        });
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
