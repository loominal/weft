/**
 * Project Manager
 *
 * Manages multiple project contexts for multi-tenant operation.
 * Projects are auto-discovered and created on first request.
 */

import type { NatsConnection } from 'nats';
import type { CoordinatorConfiguration } from '@loominal/shared';
import {
  type ProjectContext,
  createProjectContext,
  shutdownProjectContext,
} from './context.js';

/**
 * Project Manager for multi-tenant Weft
 */
export class ProjectManager {
  private projects: Map<string, ProjectContext> = new Map();
  private pendingCreations: Map<string, Promise<ProjectContext>> = new Map();

  constructor(
    private nc: NatsConnection,
    private config: CoordinatorConfiguration
  ) {}

  /**
   * Get or create a project context
   *
   * This method is safe to call concurrently - it ensures only one
   * context is created per project even with concurrent requests.
   */
  async getOrCreateProject(projectId: string): Promise<ProjectContext> {
    // Check if already exists
    const existing = this.projects.get(projectId);
    if (existing) {
      existing.lastActivityAt = new Date();
      return existing;
    }

    // Check if creation is in progress
    const pending = this.pendingCreations.get(projectId);
    if (pending) {
      return pending;
    }

    // Create new project context
    const creationPromise = this.createProject(projectId);
    this.pendingCreations.set(projectId, creationPromise);

    try {
      const context = await creationPromise;
      this.projects.set(projectId, context);
      return context;
    } finally {
      this.pendingCreations.delete(projectId);
    }
  }

  /**
   * Get a project context if it exists (does not create)
   */
  getProject(projectId: string): ProjectContext | undefined {
    const context = this.projects.get(projectId);
    if (context) {
      context.lastActivityAt = new Date();
    }
    return context;
  }

  /**
   * Check if a project exists
   */
  hasProject(projectId: string): boolean {
    return this.projects.has(projectId);
  }

  /**
   * List all active project IDs
   */
  listProjects(): string[] {
    return Array.from(this.projects.keys());
  }

  /**
   * Get all project contexts
   */
  getAllProjects(): ProjectContext[] {
    return Array.from(this.projects.values());
  }

  /**
   * Get project count
   */
  getProjectCount(): number {
    return this.projects.size;
  }

  /**
   * Get aggregated stats across all projects
   */
  async getGlobalStats(): Promise<{
    totalProjects: number;
    totals: {
      agents: number;
      pendingWork: number;
      activeWork: number;
      completedWork: number;
      failedWork: number;
      targets: number;
    };
    byProject: Record<string, {
      agents: number;
      pendingWork: number;
      activeWork: number;
      targets: number;
      lastActivity: string;
    }>;
  }> {
    const byProject: Record<string, any> = {};
    const totals = {
      agents: 0,
      pendingWork: 0,
      activeWork: 0,
      completedWork: 0,
      failedWork: 0,
      targets: 0,
    };

    for (const [projectId, context] of this.projects) {
      const coordStats = context.coordinator.getStats();
      const targets = await context.targetRegistry.getAllTargets();
      const workers = await context.coordinator.findWorkers('general');

      const projectStats = {
        agents: workers.length,
        pendingWork: coordStats.pending,
        activeWork: coordStats.active,
        targets: targets.length,
        lastActivity: context.lastActivityAt.toISOString(),
      };

      byProject[projectId] = projectStats;

      totals.agents += projectStats.agents;
      totals.pendingWork += coordStats.pending;
      totals.activeWork += coordStats.active;
      totals.completedWork += coordStats.completed;
      totals.failedWork += coordStats.failed;
      totals.targets += targets.length;
    }

    return {
      totalProjects: this.projects.size,
      totals,
      byProject,
    };
  }

  /**
   * Shutdown a specific project
   */
  async shutdownProject(projectId: string): Promise<boolean> {
    const context = this.projects.get(projectId);
    if (!context) {
      return false;
    }

    await shutdownProjectContext(context);
    this.projects.delete(projectId);
    return true;
  }

  /**
   * Shutdown all projects and clean up
   */
  async shutdown(): Promise<void> {
    console.log(`Shutting down ProjectManager with ${this.projects.size} projects...`);

    const shutdownPromises = Array.from(this.projects.values()).map((context) =>
      shutdownProjectContext(context)
    );

    await Promise.all(shutdownPromises);
    this.projects.clear();

    console.log('ProjectManager shutdown complete');
  }

  /**
   * Internal: Create a new project context
   */
  private async createProject(projectId: string): Promise<ProjectContext> {
    console.log(`Auto-discovering project: ${projectId}`);

    return createProjectContext({
      nc: this.nc,
      projectId,
      config: this.config,
    });
  }
}
