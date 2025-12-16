/**
 * Unified Scope Model for Loominal
 *
 * The scope determines both visibility and storage location:
 * - private: Just this agent, this project (project bucket, agent-keyed)
 * - personal: Just this agent, everywhere (user bucket, agent-keyed)
 * - team: All agents in this project (project bucket, shared)
 * - public: All agents everywhere (global bucket, shared)
 */

/**
 * Unified scope type used across all Loominal components
 */
export type LoominalScope = 'private' | 'personal' | 'team' | 'public';

/**
 * All valid scope values
 */
export const LOOMINAL_SCOPES: readonly LoominalScope[] = [
  'private',
  'personal',
  'team',
  'public',
] as const;

/**
 * Validates that a string is a valid LoominalScope
 */
export function isValidScope(value: unknown): value is LoominalScope {
  return (
    typeof value === 'string' &&
    LOOMINAL_SCOPES.includes(value as LoominalScope)
  );
}

/**
 * Validates scope and throws if invalid
 * @throws Error if scope is not valid
 */
export function validateScope(value: unknown): LoominalScope {
  if (!isValidScope(value)) {
    throw new Error(
      `Invalid scope: "${value}". Must be one of: ${LOOMINAL_SCOPES.join(', ')}`
    );
  }
  return value;
}

// ============================================================================
// Bucket Naming Conventions
// ============================================================================

/**
 * Get the user-level bucket name for personal/agent-specific data
 * Used for: personal scope memories, user-level agent registrations
 *
 * @param agentId - The agent's unique identifier (GUID or handle)
 * @returns Bucket name in format: loom-user-{agentId}
 */
export function getUserBucket(agentId: string): string {
  if (!agentId || typeof agentId !== 'string') {
    throw new Error('agentId is required and must be a non-empty string');
  }
  // Sanitize agentId to be bucket-name safe (lowercase, alphanumeric + hyphens)
  const sanitized = agentId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `loom-user-${sanitized}`;
}

/**
 * Get the project-level bucket name for project-scoped data
 * Used for: private scope memories, team scope memories, work queues, channels
 *
 * @param feature - The feature name (e.g., 'pattern', 'warp', 'registry')
 * @param projectId - The project identifier (typically a hash of the project path)
 * @returns Bucket name in format: loom-{feature}-{projectId}
 */
export function getProjectBucket(feature: string, projectId: string): string {
  if (!feature || typeof feature !== 'string') {
    throw new Error('feature is required and must be a non-empty string');
  }
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('projectId is required and must be a non-empty string');
  }
  // Sanitize to be bucket-name safe
  const sanitizedFeature = feature.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const sanitizedProject = projectId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `loom-${sanitizedFeature}-${sanitizedProject}`;
}

/**
 * Get the global bucket name for public/shared data
 * Used for: public scope memories, global agent registry
 *
 * @param feature - The feature name (e.g., 'pattern', 'warp', 'registry')
 * @returns Bucket name in format: loom-global-{feature}
 */
export function getGlobalBucket(feature: string): string {
  if (!feature || typeof feature !== 'string') {
    throw new Error('feature is required and must be a non-empty string');
  }
  // Sanitize to be bucket-name safe
  const sanitized = feature.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `loom-global-${sanitized}`;
}

// ============================================================================
// Scope-Based Bucket Selection
// ============================================================================

/**
 * Context needed to determine the correct bucket for a scope
 */
export interface BucketSelectionContext {
  /** The feature name (e.g., 'pattern', 'warp', 'registry') */
  feature: string;
  /** The agent's unique identifier */
  agentId: string;
  /** The project identifier */
  projectId: string;
}

/**
 * Result of bucket selection including bucket name and key prefix
 */
export interface BucketSelection {
  /** The bucket name to use */
  bucket: string;
  /** Optional key prefix within the bucket */
  keyPrefix?: string;
}

/**
 * Select the appropriate bucket based on scope
 *
 * @param scope - The scope to determine storage for
 * @param context - Context with feature, agentId, and projectId
 * @returns The bucket name and optional key prefix
 */
export function selectBucket(
  scope: LoominalScope,
  context: BucketSelectionContext
): BucketSelection {
  const { feature, agentId, projectId } = context;

  switch (scope) {
    case 'private':
      // Private: project bucket, agent-keyed
      return {
        bucket: getProjectBucket(feature, projectId),
        keyPrefix: `agent.${agentId}.`,
      };

    case 'personal':
      // Personal: user bucket, agent-keyed (follows user across projects)
      return {
        bucket: getUserBucket(agentId),
        keyPrefix: `${feature}.`,
      };

    case 'team':
      // Team: project bucket, shared (no agent prefix)
      return {
        bucket: getProjectBucket(feature, projectId),
        keyPrefix: 'shared.',
      };

    case 'public':
      // Public: global bucket, shared
      return {
        bucket: getGlobalBucket(feature),
        keyPrefix: undefined,
      };

    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Legacy scope values that may be encountered during migration
 */
export type LegacyScope =
  | 'user' // Maps to 'personal'
  | 'project' // Maps to 'team'
  | 'shared'; // Maps to 'team'

/**
 * Legacy visibility values from Warp
 */
export type LegacyVisibility =
  | 'private' // Maps to 'private'
  | 'project-only' // Maps to 'team'
  | 'user-only' // Maps to 'personal'
  | 'public'; // Maps to 'public'

/**
 * Maps old scope values to new unified scope
 * Returns null if value is not a known legacy scope
 */
export function migrateLegacyScope(
  value: string
): LoominalScope | null {
  const legacyMapping: Record<string, LoominalScope> = {
    // Old Pattern scope values
    user: 'personal',
    project: 'team',
    shared: 'team',
    // Already valid new values
    private: 'private',
    personal: 'personal',
    team: 'team',
    public: 'public',
  };

  return legacyMapping[value] ?? null;
}

/**
 * Maps old visibility values to new unified scope
 * Returns null if value is not a known legacy visibility
 */
export function migrateLegacyVisibility(
  value: string
): LoominalScope | null {
  const visibilityMapping: Record<string, LoominalScope> = {
    private: 'private',
    'project-only': 'team',
    'user-only': 'personal',
    public: 'public',
  };

  return visibilityMapping[value] ?? null;
}

/**
 * Attempts to migrate any legacy scope or visibility value to the new scope model
 * Useful for backward compatibility during transition period
 *
 * @param value - The scope or visibility value to migrate
 * @returns The new scope value, or throws if not recognized
 */
export function migrateToUnifiedScope(value: unknown): LoominalScope {
  if (typeof value !== 'string') {
    throw new Error(`Cannot migrate non-string value: ${value}`);
  }

  // Try as-is (already valid)
  if (isValidScope(value)) {
    return value;
  }

  // Try legacy scope mapping
  const fromScope = migrateLegacyScope(value);
  if (fromScope) {
    return fromScope;
  }

  // Try legacy visibility mapping
  const fromVisibility = migrateLegacyVisibility(value);
  if (fromVisibility) {
    return fromVisibility;
  }

  throw new Error(
    `Cannot migrate unknown scope/visibility value: "${value}". ` +
      `Valid scopes: ${LOOMINAL_SCOPES.join(', ')}`
  );
}
