/**
 * NATS subject patterns for the coordinator system
 *
 * All subjects are prefixed with the project namespace for isolation.
 */

/**
 * Build a namespaced subject
 */
export function buildSubject(projectId: string, ...parts: string[]): string {
  return `loominal.${projectId}.${parts.join('.')}`;
}

/**
 * Subject patterns for work queues
 */
export const WorkSubjects = {
  /**
   * Work queue for a specific capability
   * Pattern: loominal.{projectId}.work.queue.{capability}
   */
  queue: (projectId: string, capability: string) =>
    buildSubject(projectId, 'work', 'queue', capability),

  /**
   * Work status updates
   * Pattern: loominal.{projectId}.work.status.{workItemId}
   */
  status: (projectId: string, workItemId: string) =>
    buildSubject(projectId, 'work', 'status', workItemId),

  /**
   * Work completion notifications
   * Pattern: loominal.{projectId}.work.completed
   */
  completed: (projectId: string) =>
    buildSubject(projectId, 'work', 'completed'),

  /**
   * Work error notifications
   * Pattern: loominal.{projectId}.work.errors
   */
  errors: (projectId: string) =>
    buildSubject(projectId, 'work', 'errors'),
};

/**
 * Subject patterns for agent communication
 */
export const AgentSubjects = {
  /**
   * Agent inbox for direct messages
   * Pattern: loominal.{projectId}.agent.inbox.{guid}
   */
  inbox: (projectId: string, guid: string) =>
    buildSubject(projectId, 'agent', 'inbox', guid),

  /**
   * Agent registration announcements
   * Pattern: loominal.{projectId}.agent.register
   */
  register: (projectId: string) =>
    buildSubject(projectId, 'agent', 'register'),

  /**
   * Agent deregistration announcements
   * Pattern: loominal.{projectId}.agent.deregister
   */
  deregister: (projectId: string) =>
    buildSubject(projectId, 'agent', 'deregister'),

  /**
   * Agent heartbeat
   * Pattern: loominal.{projectId}.agent.heartbeat.{guid}
   */
  heartbeat: (projectId: string, guid: string) =>
    buildSubject(projectId, 'agent', 'heartbeat', guid),

  /**
   * Agent shutdown request
   * Pattern: loominal.{projectId}.agent.shutdown.{guid}
   */
  shutdown: (projectId: string, guid: string) =>
    buildSubject(projectId, 'agent', 'shutdown', guid),
};

/**
 * Subject patterns for coordinator control
 */
export const CoordinatorSubjects = {
  /**
   * Commands to coordinator
   * Pattern: loominal.{projectId}.coordinator.command
   */
  command: (projectId: string) =>
    buildSubject(projectId, 'coordinator', 'command'),

  /**
   * Coordinator status broadcasts
   * Pattern: loominal.{projectId}.coordinator.status
   */
  status: (projectId: string) =>
    buildSubject(projectId, 'coordinator', 'status'),

  /**
   * Spin-up requests
   * Pattern: loominal.{projectId}.coordinator.spin-up.request
   */
  spinUpRequest: (projectId: string) =>
    buildSubject(projectId, 'coordinator', 'spin-up', 'request'),

  /**
   * Spin-up status updates
   * Pattern: loominal.{projectId}.coordinator.spin-up.status
   */
  spinUpStatus: (projectId: string) =>
    buildSubject(projectId, 'coordinator', 'spin-up', 'status'),
};

/**
 * Stream names for JetStream
 */
export const StreamNames = {
  /**
   * Work queue stream
   */
  workQueue: (projectId: string) => `LOOMINAL_WORK_${projectId}`,

  /**
   * Agent registry stream
   */
  agentRegistry: (projectId: string) => `LOOMINAL_AGENTS_${projectId}`,

  /**
   * Dead letter queue stream
   */
  deadLetter: (projectId: string) => `LOOMINAL_DLQ_${projectId}`,
};

/**
 * Subject patterns for spin-up targets
 */
export const TargetSubjects = {
  /**
   * Target registration announcements
   * Pattern: loominal.{projectId}.targets.register
   */
  register: (projectId: string) =>
    buildSubject(projectId, 'targets', 'register'),

  /**
   * Target update announcements
   * Pattern: loominal.{projectId}.targets.update
   */
  update: (projectId: string) =>
    buildSubject(projectId, 'targets', 'update'),

  /**
   * Target removal announcements
   * Pattern: loominal.{projectId}.targets.remove
   */
  remove: (projectId: string) =>
    buildSubject(projectId, 'targets', 'remove'),

  /**
   * Target health check results
   * Pattern: loominal.{projectId}.targets.health.{targetId}
   */
  health: (projectId: string, targetId: string) =>
    buildSubject(projectId, 'targets', 'health', targetId),
};

/**
 * KV bucket names
 */
export const KVBuckets = {
  /**
   * Agent registry KV bucket
   */
  agentRegistry: (projectId: string) => `loominal-agents-${projectId}`,

  /**
   * Work item state KV bucket
   */
  workState: (projectId: string) => `loominal-work-${projectId}`,

  /**
   * Spin-up target registry KV bucket
   */
  targetRegistry: (projectId: string) => `loominal-targets-${projectId}`,

  /**
   * Configuration KV bucket
   */
  config: (projectId: string) => `loominal-config-${projectId}`,
};
