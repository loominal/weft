// Scope types (unified scope model)
export type {
  LoominalScope,
  LegacyScope,
  LegacyVisibility,
  BucketSelectionContext,
  BucketSelection,
} from './scope.js';

export {
  LOOMINAL_SCOPES,
  isValidScope,
  validateScope,
  getUserBucket,
  getProjectBucket,
  getGlobalBucket,
  selectBucket,
  migrateLegacyScope,
  migrateLegacyVisibility,
  migrateToUnifiedScope,
} from './scope.js';

// Work item types
export type {
  Boundary,
  AgentType,
  WorkItemStatus,
  Priority,
  BaseWorkItem,
  CoordinatedWorkItem,
  WorkItemResult,
  WorkItemError,
  WorkSubmitRequest,
  WorkSubmitResponse,
} from './work-item.js';

// Agent types
export type {
  AgentStatus,
  AgentVisibility,
  RegisteredAgent,
  AgentRegisterRequest,
  AgentHeartbeat,
  AgentShutdownRequest,
  AgentDiscoveryFilter,
} from './agent.js';

// Routing types
export type {
  RoutingDecision,
  EligibilityResult,
  BoundaryConfig,
} from './routing.js';

// Configuration types
export type {
  NATSConfiguration,
  APIConfiguration,
  IdleConfiguration,
  SpinUpBehaviorConfiguration,
  CoordinatorConfiguration,
  CLIConfiguration,
} from './config.js';

export {
  DEFAULT_COORDINATOR_CONFIG,
  DEFAULT_CLI_CONFIG,
} from './config.js';

// Spin-up target types (dynamic registry)
export type {
  SpinUpMechanism,
  TargetStatus,
  HealthStatus,
  SSHMechanismConfig,
  GitHubActionsMechanismConfig,
  LocalMechanismConfig,
  WebhookMechanismConfig,
  KubernetesMechanismConfig,
  MechanismConfig,
  SpinUpTarget,
  TargetRegisterRequest,
  TargetUpdateRequest,
  TargetQueryFilter,
  SpinUpResult,
  HealthCheckResult,
} from './spin-up-target.js';
