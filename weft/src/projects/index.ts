/**
 * Projects module
 *
 * Multi-tenant project management for Weft coordinator.
 */

export { ProjectManager } from './manager.js';
export {
  type ProjectContext,
  type ProjectContextOptions,
  createProjectContext,
  shutdownProjectContext,
} from './context.js';
