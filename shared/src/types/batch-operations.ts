import type { AgentType, Boundary } from './work-item.js';
import type { AgentStatus } from './agent.js';

/**
 * Filter for selecting agents in batch operations
 */
export interface AgentBatchFilter {
  /** Filter by agent status */
  status?: AgentStatus;

  /** Filter by idle time threshold (ms) */
  idleTimeMs?: number;

  /** Filter by agent type */
  agentType?: AgentType;

  /** Filter by boundary they accept */
  boundary?: Boundary;

  /** Filter by capability */
  capability?: string;
}

/**
 * Request to perform batch shutdown of agents
 */
export interface BatchShutdownRequest {
  /** Filter criteria for selecting agents (alternative to agentGuids) */
  filter?: AgentBatchFilter;

  /** Specific agent GUIDs to shutdown (alternative to filter) */
  agentGuids?: string[];

  /** Whether to perform graceful shutdown (wait for current work) */
  graceful?: boolean;

  /** Grace period in ms if graceful (default: 30000) */
  gracePeriodMs?: number;

  /** Reason for shutdown */
  reason?: 'manual' | 'scaling-down' | 'maintenance' | 'error';
}

/**
 * Filter for selecting targets in batch operations
 */
export interface TargetBatchFilter {
  /** Filter by agent type this target provisions */
  agentType?: AgentType;

  /** Filter by target status */
  status?: string;

  /** Filter by mechanism type */
  mechanism?: string;
}

/**
 * Request to disable spin-up targets in batch
 */
export interface BatchDisableTargetsRequest {
  /** Filter criteria for selecting targets (alternative to targetIds) */
  filter?: TargetBatchFilter;

  /** Specific target IDs to disable (alternative to filter) */
  targetIds?: string[];

  /** Whether to prevent future spin-ups */
  preventSpinUp?: boolean;
}

/**
 * Filter for selecting work items in batch operations
 */
export interface WorkBatchFilter {
  /** Filter by work status */
  status?: string;

  /** Filter by boundary */
  boundary?: Boundary;

  /** Filter by capability */
  capability?: string;

  /** Filter by priority (min threshold) */
  minPriority?: number;

  /** Filter by assigned agent */
  assignedTo?: string;
}

/**
 * Request to cancel work items in batch
 */
export interface BatchCancelWorkRequest {
  /** Filter criteria for selecting work items (alternative to workItemIds) */
  filter?: WorkBatchFilter;

  /** Specific work item IDs to cancel (alternative to filter) */
  workItemIds?: string[];

  /** Reason for cancellation */
  reason?: 'user-requested' | 'deadline-passed' | 'resource-constraint' | 'system-shutdown';

  /** Whether to reassign cancelled work to other agents */
  reassign?: boolean;
}

/**
 * Response from batch operations with success/failure details
 */
export interface BatchOperationResponse {
  /** IDs/GUIDs of successfully processed items */
  success: string[];

  /** IDs/GUIDs of failed items */
  failed: string[];

  /** Total count of successful operations */
  count: number;

  /** Detailed error information keyed by ID */
  errors: Record<string, string>;

  /** Timestamp of operation completion */
  completedAt: string;

  /** Total items processed */
  totalProcessed: number;

  /** Success rate percentage */
  successRate: number;
}

/**
 * Response specific to batch shutdown operations
 */
export interface BatchShutdownResponse extends BatchOperationResponse {
  /** Agent GUIDs that were successfully shut down */
  shutdownAgents: string[];

  /** Whether shutdown was graceful */
  graceful: boolean;
}

/**
 * Response specific to batch target disable operations
 */
export interface BatchDisableTargetsResponse extends BatchOperationResponse {
  /** Target IDs that were successfully disabled */
  disabledTargets: string[];

  /** Targets that were already disabled */
  alreadyDisabled: string[];
}

/**
 * Response specific to batch work cancellation
 */
export interface BatchCancelWorkResponse extends BatchOperationResponse {
  /** Work item IDs that were cancelled */
  cancelledItems: string[];

  /** Work items that were reassigned to other agents */
  reassignedItems: string[];

  /** Work items that could not be cancelled (already completed) */
  notCancellable: string[];
}
