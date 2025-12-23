/**
 * Base Coordinator
 *
 * Handles work item storage, assignment tracking, and completion recording.
 * Uses in-memory storage with optional persistence callbacks.
 * Emits events for all state changes.
 */

import { EventEmitter } from 'events';
import type {
  CoordinatedWorkItem,
  WorkItemStatus,
  Priority,
  WorkSubmittedEvent,
  WorkAssignedEvent,
  WorkStartedEvent,
  WorkProgressEvent,
  WorkCompletedEvent,
  WorkFailedEvent,
  WorkCancelledEvent,
  CoordinatorEventType,
} from '@loominal/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Work request for submission
 */
export interface WorkRequest {
  taskId: string;
  description: string;
  capability: string;
  priority?: Priority;
  deadline?: string;
  contextData?: Record<string, unknown>;
}

/**
 * Base coordinator configuration
 */
export interface BaseCoordinatorConfig {
  /** Project ID for event metadata */
  projectId?: string;
  /** How long before unassigned work is considered stale (ms) */
  staleThresholdMs?: number;
  /** How often to clean up stale work (ms) */
  cleanupIntervalMs?: number;
}

/**
 * Assignment filter for querying work items
 */
export interface AssignmentFilter {
  status?: WorkItemStatus;
  capability?: string;
  assignedTo?: string;
}

/**
 * Coordinator statistics
 */
export interface CoordinatorStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Base coordinator class for work management
 *
 * Events emitted:
 * - 'work:submitted' (WorkSubmittedEvent): When work is submitted
 * - 'work:assigned' (WorkAssignedEvent): When work is assigned to an agent
 * - 'work:started' (WorkStartedEvent): When work transitions to in-progress
 * - 'work:progress' (WorkProgressEvent): When work progress is updated
 * - 'work:completed' (WorkCompletedEvent): When work completes successfully
 * - 'work:failed' (WorkFailedEvent): When work fails with an error
 * - 'work:cancelled' (WorkCancelledEvent): When work is cancelled
 */
export class BaseCoordinator extends EventEmitter {
  private workItems: Map<string, CoordinatedWorkItem> = new Map();
  private config: Required<BaseCoordinatorConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: BaseCoordinatorConfig = {}) {
    super();
    this.config = {
      projectId: config.projectId ?? 'default',
      staleThresholdMs: config.staleThresholdMs ?? 300000, // 5 minutes
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60000, // 1 minute
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleWork(),
      this.config.cleanupIntervalMs
    );
  }

  /**
   * Submit new work
   * @returns Work item ID
   */
  submitWork(request: WorkRequest): string {
    const id = uuidv4();
    const now = new Date().toISOString();

    const workItem: CoordinatedWorkItem = {
      id,
      taskId: request.taskId,
      description: request.description,
      capability: request.capability,
      priority: request.priority ?? 5,
      deadline: request.deadline,
      contextData: request.contextData,
      boundary: 'personal', // Default, will be overridden by ExtendedCoordinator
      status: 'pending',
      offeredBy: 'coordinator',
      offeredAt: now,
      attempts: 0,
    };

    this.workItems.set(id, workItem);

    // Emit work submitted event
    const event: WorkSubmittedEvent = {
      type: 'work:submitted' as CoordinatorEventType.WORK_SUBMITTED,
      timestamp: now,
      projectId: this.config.projectId,
      workId: id,
      taskId: request.taskId,
      capability: request.capability,
      boundary: workItem.boundary,
      priority: workItem.priority,
      description: request.description,
    };
    this.emit('work:submitted', event);

    return id;
  }

  /**
   * Get a work item by ID
   */
  getWorkItem(id: string): CoordinatedWorkItem | undefined {
    return this.workItems.get(id);
  }

  /**
   * Record that a worker has claimed work
   * @returns true if claim was successful
   */
  async recordClaim(workItemId: string, workerGuid: string): Promise<boolean> {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) {
      return false;
    }

    // Only allow claiming pending work
    if (workItem.status !== 'pending') {
      return false;
    }

    const now = new Date().toISOString();
    workItem.status = 'assigned';
    workItem.assignedTo = workerGuid;
    workItem.assignedAt = now;
    workItem.attempts += 1;

    // Emit work assigned event
    // Note: AgentSummary will be populated by ExtendedCoordinator
    const event: WorkAssignedEvent = {
      type: 'work:assigned' as CoordinatorEventType.WORK_ASSIGNED,
      timestamp: now,
      projectId: this.config.projectId,
      workId: workItemId,
      taskId: workItem.taskId,
      assignedTo: workerGuid,
      assignedToAgent: {
        guid: workerGuid,
        agentType: 'claude-code', // Default, will be enriched by ExtendedCoordinator
      },
      capability: workItem.capability,
      boundary: workItem.boundary,
    };
    this.emit('work:assigned', event);

    return true;
  }

  /**
   * Update work item status to in-progress
   */
  startWork(workItemId: string): boolean {
    const workItem = this.workItems.get(workItemId);
    if (!workItem || workItem.status !== 'assigned') {
      return false;
    }

    const now = new Date().toISOString();
    workItem.status = 'in-progress';

    // Emit work started event
    if (workItem.assignedTo) {
      const event: WorkStartedEvent = {
        type: 'work:started' as CoordinatorEventType.WORK_STARTED,
        timestamp: now,
        projectId: this.config.projectId,
        workId: workItemId,
        taskId: workItem.taskId,
        assignedTo: workItem.assignedTo,
        assignedToAgent: {
          guid: workItem.assignedTo,
          agentType: 'claude-code',
        },
      };
      this.emit('work:started', event);
    }

    return true;
  }

  /**
   * Update work progress
   */
  updateProgress(workItemId: string, progress: number): boolean {
    const workItem = this.workItems.get(workItemId);
    if (!workItem || (workItem.status !== 'assigned' && workItem.status !== 'in-progress')) {
      return false;
    }

    const now = new Date().toISOString();
    workItem.progress = Math.min(100, Math.max(0, progress));

    // Emit work progress event
    if (workItem.assignedTo) {
      const event: WorkProgressEvent = {
        type: 'work:progress' as CoordinatorEventType.WORK_PROGRESS,
        timestamp: now,
        projectId: this.config.projectId,
        workId: workItemId,
        taskId: workItem.taskId,
        assignedTo: workItem.assignedTo,
        assignedToAgent: {
          guid: workItem.assignedTo,
          agentType: 'claude-code',
        },
        progress: workItem.progress,
      };
      this.emit('work:progress', event);
    }

    return true;
  }

  /**
   * Record work completion
   */
  recordCompletion(
    workItemId: string,
    result?: Record<string, unknown>,
    summary?: string
  ): boolean {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) {
      return false;
    }

    const now = new Date().toISOString();
    workItem.status = 'completed';
    workItem.progress = 100;
    workItem.result = {
      summary,
      output: result,
      completedAt: now,
    };

    // Emit work completed event
    const event: WorkCompletedEvent = {
      type: 'work:completed' as CoordinatorEventType.WORK_COMPLETED,
      timestamp: now,
      projectId: this.config.projectId,
      workId: workItemId,
      taskId: workItem.taskId,
      assignedTo: workItem.assignedTo,
      assignedToAgent: workItem.assignedTo ? {
        guid: workItem.assignedTo,
        agentType: 'claude-code',
      } : undefined,
      summary,
    };
    this.emit('work:completed', event);

    return true;
  }

  /**
   * Record work error
   */
  async recordError(
    workItemId: string,
    errorMessage: string,
    recoverable: boolean
  ): Promise<boolean> {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) {
      return false;
    }

    const now = new Date().toISOString();
    workItem.status = 'failed';
    workItem.error = {
      message: errorMessage,
      recoverable,
      occurredAt: now,
    };

    // Emit work failed event
    const event: WorkFailedEvent = {
      type: 'work:failed' as CoordinatorEventType.WORK_FAILED,
      timestamp: now,
      projectId: this.config.projectId,
      workId: workItemId,
      taskId: workItem.taskId,
      assignedTo: workItem.assignedTo,
      assignedToAgent: workItem.assignedTo ? {
        guid: workItem.assignedTo,
        agentType: 'claude-code',
      } : undefined,
      errorMessage,
      recoverable,
    };
    this.emit('work:failed', event);

    return true;
  }

  /**
   * Cancel work
   */
  cancelWork(workItemId: string): boolean {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) {
      return false;
    }

    if (workItem.status === 'completed' || workItem.status === 'failed') {
      return false;
    }

    const now = new Date().toISOString();
    workItem.status = 'cancelled';

    // Emit work cancelled event
    const event: WorkCancelledEvent = {
      type: 'work:cancelled' as CoordinatorEventType.WORK_CANCELLED,
      timestamp: now,
      projectId: this.config.projectId,
      workId: workItemId,
      taskId: workItem.taskId,
      assignedTo: workItem.assignedTo,
      assignedToAgent: workItem.assignedTo ? {
        guid: workItem.assignedTo,
        agentType: 'claude-code',
      } : undefined,
    };
    this.emit('work:cancelled', event);

    return true;
  }

  /**
   * Get assignment status
   */
  getAssignment(workItemId: string): CoordinatedWorkItem | undefined {
    return this.workItems.get(workItemId);
  }

  /**
   * Get all assignments matching a filter
   */
  getAssignments(filter?: AssignmentFilter): CoordinatedWorkItem[] {
    const results: CoordinatedWorkItem[] = [];

    for (const workItem of this.workItems.values()) {
      if (filter?.status && workItem.status !== filter.status) {
        continue;
      }
      if (filter?.capability && workItem.capability !== filter.capability) {
        continue;
      }
      if (filter?.assignedTo && workItem.assignedTo !== filter.assignedTo) {
        continue;
      }
      results.push(workItem);
    }

    // Sort by priority (higher first), then by offered time (older first)
    return results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.offeredAt).getTime() - new Date(b.offeredAt).getTime();
    });
  }

  /**
   * Get pending work for a capability
   */
  getPendingWork(capability: string): CoordinatedWorkItem[] {
    return this.getAssignments({ status: 'pending', capability });
  }

  /**
   * Get statistics
   */
  getStats(): CoordinatorStats {
    let pending = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const workItem of this.workItems.values()) {
      switch (workItem.status) {
        case 'pending':
          pending++;
          break;
        case 'assigned':
        case 'in-progress':
          active++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
        case 'cancelled':
          failed++;
          break;
      }
    }

    return {
      pending,
      active,
      completed,
      failed,
      total: this.workItems.size,
    };
  }

  /**
   * Clean up stale work items
   */
  private cleanupStaleWork(): void {
    const now = Date.now();
    const staleThreshold = this.config.staleThresholdMs;

    for (const [id, workItem] of this.workItems) {
      // Remove completed/failed work older than stale threshold
      if (
        workItem.status === 'completed' ||
        workItem.status === 'failed' ||
        workItem.status === 'cancelled'
      ) {
        const completedAt = workItem.result?.completedAt || workItem.error?.occurredAt;
        if (completedAt) {
          const age = now - new Date(completedAt).getTime();
          if (age > staleThreshold * 2) {
            // Keep completed work twice as long
            this.workItems.delete(id);
          }
        }
      }

      // Reset assigned work that's been stuck too long
      if (workItem.status === 'assigned' && workItem.assignedAt) {
        const age = now - new Date(workItem.assignedAt).getTime();
        if (age > staleThreshold) {
          // Reset to pending for re-assignment
          workItem.status = 'pending';
          workItem.assignedTo = undefined;
          workItem.assignedAt = undefined;
        }
      }
    }
  }

  /**
   * Shutdown the coordinator
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.removeAllListeners();
  }
}
