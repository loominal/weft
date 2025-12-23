/**
 * Coordinator Event Types
 *
 * Defines event payloads emitted by the coordinator when state changes occur.
 * These events enable real-time monitoring and WebSocket broadcasting.
 */

import type { AgentSummary } from './semantic-context.js';
import type { Boundary, AgentType } from './work-item.js';
import type { AgentStatus } from './agent.js';
import type { TargetStatus, HealthStatus } from './spin-up-target.js';

/**
 * Coordinator event types
 */
export enum CoordinatorEventType {
  // Agent lifecycle events
  AGENT_REGISTERED = 'agent:registered',
  AGENT_UPDATED = 'agent:updated',
  AGENT_SHUTDOWN = 'agent:shutdown',

  // Work lifecycle events
  WORK_SUBMITTED = 'work:submitted',
  WORK_ASSIGNED = 'work:assigned',
  WORK_STARTED = 'work:started',
  WORK_PROGRESS = 'work:progress',
  WORK_COMPLETED = 'work:completed',
  WORK_FAILED = 'work:failed',
  WORK_CANCELLED = 'work:cancelled',

  // Target lifecycle events
  TARGET_REGISTERED = 'target:registered',
  TARGET_UPDATED = 'target:updated',
  TARGET_DISABLED = 'target:disabled',
  TARGET_REMOVED = 'target:removed',
  TARGET_HEALTH_CHANGED = 'target:health-changed',

  // Spin-up events
  SPIN_UP_TRIGGERED = 'spin-up:triggered',
  SPIN_UP_STARTED = 'spin-up:started',
  SPIN_UP_COMPLETED = 'spin-up:completed',
  SPIN_UP_FAILED = 'spin-up:failed',
}

/**
 * Base event interface
 */
export interface BaseCoordinatorEvent {
  type: CoordinatorEventType;
  timestamp: string;
  projectId: string;
}

/**
 * Agent registered event
 * Emitted when a new agent registers with the coordinator
 */
export interface AgentRegisteredEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.AGENT_REGISTERED;
  agent: AgentSummary;
  capabilities: string[];
  boundaries: Boundary[];
  status: AgentStatus;
}

/**
 * Agent updated event
 * Emitted when an agent's status or task count changes
 */
export interface AgentUpdatedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.AGENT_UPDATED;
  agent: AgentSummary;
  previousStatus?: AgentStatus;
  newStatus: AgentStatus;
  currentTaskCount: number;
}

/**
 * Agent shutdown event
 * Emitted when an agent is shutting down
 */
export interface AgentShutdownEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.AGENT_SHUTDOWN;
  agent: AgentSummary;
  reason: 'idle-timeout' | 'manual' | 'coordinator-shutdown' | 'error';
  graceful: boolean;
}

/**
 * Work submitted event
 * Emitted when new work is submitted to the coordinator
 */
export interface WorkSubmittedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_SUBMITTED;
  workId: string;
  taskId: string;
  capability: string;
  boundary: Boundary;
  priority: number;
  description: string;
}

/**
 * Work assigned event
 * Emitted when work is assigned to an agent
 */
export interface WorkAssignedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_ASSIGNED;
  workId: string;
  taskId: string;
  assignedTo: string;
  assignedToAgent: AgentSummary;
  capability: string;
  boundary: Boundary;
}

/**
 * Work started event
 * Emitted when an agent starts working on assigned work
 */
export interface WorkStartedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_STARTED;
  workId: string;
  taskId: string;
  assignedTo: string;
  assignedToAgent: AgentSummary;
}

/**
 * Work progress event
 * Emitted when work progress is updated
 */
export interface WorkProgressEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_PROGRESS;
  workId: string;
  taskId: string;
  assignedTo: string;
  assignedToAgent: AgentSummary;
  progress: number;
}

/**
 * Work completed event
 * Emitted when work is successfully completed
 */
export interface WorkCompletedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_COMPLETED;
  workId: string;
  taskId: string;
  assignedTo?: string;
  assignedToAgent?: AgentSummary;
  summary?: string;
}

/**
 * Work failed event
 * Emitted when work fails with an error
 */
export interface WorkFailedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_FAILED;
  workId: string;
  taskId: string;
  assignedTo?: string;
  assignedToAgent?: AgentSummary;
  errorMessage: string;
  recoverable: boolean;
}

/**
 * Work cancelled event
 * Emitted when work is cancelled
 */
export interface WorkCancelledEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.WORK_CANCELLED;
  workId: string;
  taskId: string;
  assignedTo?: string;
  assignedToAgent?: AgentSummary;
}

/**
 * Target registered event
 * Emitted when a new spin-up target is registered
 */
export interface TargetRegisteredEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.TARGET_REGISTERED;
  targetId: string;
  targetName: string;
  agentType: AgentType;
  capabilities: string[];
  boundaries: Boundary[];
  mechanism: string;
}

/**
 * Target updated event
 * Emitted when a target's configuration or status changes
 */
export interface TargetUpdatedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.TARGET_UPDATED;
  targetId: string;
  targetName: string;
  previousStatus?: TargetStatus;
  newStatus: TargetStatus;
}

/**
 * Target disabled event
 * Emitted when a target is disabled
 */
export interface TargetDisabledEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.TARGET_DISABLED;
  targetId: string;
  targetName: string;
  reason?: string;
}

/**
 * Target removed event
 * Emitted when a target is removed from the registry
 */
export interface TargetRemovedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.TARGET_REMOVED;
  targetId: string;
  targetName: string;
}

/**
 * Target health changed event
 * Emitted when a target's health status changes
 */
export interface TargetHealthChangedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.TARGET_HEALTH_CHANGED;
  targetId: string;
  targetName: string;
  previousHealth?: HealthStatus;
  newHealth: HealthStatus;
  error?: string;
}

/**
 * Spin-up triggered event
 * Emitted when the coordinator determines a spin-up is needed
 */
export interface SpinUpTriggeredEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.SPIN_UP_TRIGGERED;
  targetAgentType: AgentType;
  capability: string;
  boundary: Boundary;
  workId: string;
}

/**
 * Spin-up started event
 * Emitted when a target begins the spin-up process
 */
export interface SpinUpStartedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.SPIN_UP_STARTED;
  targetId: string;
  targetName: string;
  agentType: AgentType;
  capability: string;
  workId?: string;
}

/**
 * Spin-up completed event
 * Emitted when a spin-up successfully completes
 */
export interface SpinUpCompletedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.SPIN_UP_COMPLETED;
  targetId: string;
  targetName: string;
  agentType: AgentType;
  agentGuid?: string;
  durationMs: number;
}

/**
 * Spin-up failed event
 * Emitted when a spin-up attempt fails
 */
export interface SpinUpFailedEvent extends BaseCoordinatorEvent {
  type: CoordinatorEventType.SPIN_UP_FAILED;
  targetId: string;
  targetName: string;
  agentType: AgentType;
  errorMessage: string;
  workId?: string;
}

/**
 * Union type of all coordinator events
 */
export type CoordinatorEvent =
  | AgentRegisteredEvent
  | AgentUpdatedEvent
  | AgentShutdownEvent
  | WorkSubmittedEvent
  | WorkAssignedEvent
  | WorkStartedEvent
  | WorkProgressEvent
  | WorkCompletedEvent
  | WorkFailedEvent
  | WorkCancelledEvent
  | TargetRegisteredEvent
  | TargetUpdatedEvent
  | TargetDisabledEvent
  | TargetRemovedEvent
  | TargetHealthChangedEvent
  | SpinUpTriggeredEvent
  | SpinUpStartedEvent
  | SpinUpCompletedEvent
  | SpinUpFailedEvent;
