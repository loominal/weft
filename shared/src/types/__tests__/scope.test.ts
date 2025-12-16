import { describe, it, expect } from 'vitest';
import {
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
} from '../scope.js';

describe('LoominalScope', () => {
  describe('LOOMINAL_SCOPES', () => {
    it('contains all four scope values', () => {
      expect(LOOMINAL_SCOPES).toEqual(['private', 'personal', 'team', 'public']);
    });

    it('has exactly 4 values', () => {
      expect(LOOMINAL_SCOPES.length).toBe(4);
    });
  });

  describe('isValidScope', () => {
    it('returns true for valid scopes', () => {
      expect(isValidScope('private')).toBe(true);
      expect(isValidScope('personal')).toBe(true);
      expect(isValidScope('team')).toBe(true);
      expect(isValidScope('public')).toBe(true);
    });

    it('returns false for invalid scopes', () => {
      expect(isValidScope('invalid')).toBe(false);
      expect(isValidScope('shared')).toBe(false);
      expect(isValidScope('')).toBe(false);
      expect(isValidScope(null)).toBe(false);
      expect(isValidScope(undefined)).toBe(false);
      expect(isValidScope(123)).toBe(false);
      expect(isValidScope({})).toBe(false);
    });
  });

  describe('validateScope', () => {
    it('returns the scope for valid values', () => {
      expect(validateScope('private')).toBe('private');
      expect(validateScope('personal')).toBe('personal');
      expect(validateScope('team')).toBe('team');
      expect(validateScope('public')).toBe('public');
    });

    it('throws for invalid scopes', () => {
      expect(() => validateScope('invalid')).toThrow(
        'Invalid scope: "invalid". Must be one of: private, personal, team, public'
      );
      expect(() => validateScope(null)).toThrow('Invalid scope');
    });
  });
});

describe('Bucket Naming', () => {
  describe('getUserBucket', () => {
    it('returns correct bucket name', () => {
      expect(getUserBucket('agent-123')).toBe('loom-user-agent-123');
      expect(getUserBucket('my-agent')).toBe('loom-user-my-agent');
    });

    it('sanitizes agent IDs', () => {
      expect(getUserBucket('Agent_123')).toBe('loom-user-agent-123');
      expect(getUserBucket('Agent.Test')).toBe('loom-user-agent-test');
      expect(getUserBucket('UPPERCASE')).toBe('loom-user-uppercase');
    });

    it('throws for empty agentId', () => {
      expect(() => getUserBucket('')).toThrow('agentId is required');
      // @ts-expect-error - testing runtime behavior
      expect(() => getUserBucket(null)).toThrow('agentId is required');
    });
  });

  describe('getProjectBucket', () => {
    it('returns correct bucket name', () => {
      expect(getProjectBucket('pattern', 'abc123')).toBe('loom-pattern-abc123');
      expect(getProjectBucket('warp', 'project-1')).toBe('loom-warp-project-1');
    });

    it('sanitizes inputs', () => {
      expect(getProjectBucket('Pattern', 'ABC123')).toBe('loom-pattern-abc123');
      expect(getProjectBucket('my_feature', 'project.name')).toBe(
        'loom-my-feature-project-name'
      );
    });

    it('throws for empty feature', () => {
      expect(() => getProjectBucket('', 'project')).toThrow('feature is required');
    });

    it('throws for empty projectId', () => {
      expect(() => getProjectBucket('pattern', '')).toThrow('projectId is required');
    });
  });

  describe('getGlobalBucket', () => {
    it('returns correct bucket name', () => {
      expect(getGlobalBucket('pattern')).toBe('loom-global-pattern');
      expect(getGlobalBucket('registry')).toBe('loom-global-registry');
    });

    it('sanitizes feature name', () => {
      expect(getGlobalBucket('Pattern')).toBe('loom-global-pattern');
      expect(getGlobalBucket('my_feature')).toBe('loom-global-my-feature');
    });

    it('throws for empty feature', () => {
      expect(() => getGlobalBucket('')).toThrow('feature is required');
    });
  });
});

describe('selectBucket', () => {
  const context = {
    feature: 'pattern',
    agentId: 'agent-1',
    projectId: 'project-abc',
  };

  it('selects project bucket with agent prefix for private scope', () => {
    const result = selectBucket('private', context);
    expect(result.bucket).toBe('loom-pattern-project-abc');
    expect(result.keyPrefix).toBe('agent.agent-1.');
  });

  it('selects user bucket for personal scope', () => {
    const result = selectBucket('personal', context);
    expect(result.bucket).toBe('loom-user-agent-1');
    expect(result.keyPrefix).toBe('pattern.');
  });

  it('selects project bucket with shared prefix for team scope', () => {
    const result = selectBucket('team', context);
    expect(result.bucket).toBe('loom-pattern-project-abc');
    expect(result.keyPrefix).toBe('shared.');
  });

  it('selects global bucket for public scope', () => {
    const result = selectBucket('public', context);
    expect(result.bucket).toBe('loom-global-pattern');
    expect(result.keyPrefix).toBeUndefined();
  });

  it('throws for unknown scope', () => {
    expect(() =>
      // @ts-expect-error - testing runtime behavior
      selectBucket('unknown', context)
    ).toThrow('Unknown scope: unknown');
  });
});

describe('Migration Helpers', () => {
  describe('migrateLegacyScope', () => {
    it('maps old Pattern scope values', () => {
      expect(migrateLegacyScope('user')).toBe('personal');
      expect(migrateLegacyScope('project')).toBe('team');
      expect(migrateLegacyScope('shared')).toBe('team');
    });

    it('passes through new scope values', () => {
      expect(migrateLegacyScope('private')).toBe('private');
      expect(migrateLegacyScope('personal')).toBe('personal');
      expect(migrateLegacyScope('team')).toBe('team');
      expect(migrateLegacyScope('public')).toBe('public');
    });

    it('returns null for unknown values', () => {
      expect(migrateLegacyScope('invalid')).toBeNull();
      expect(migrateLegacyScope('')).toBeNull();
    });
  });

  describe('migrateLegacyVisibility', () => {
    it('maps old Warp visibility values', () => {
      expect(migrateLegacyVisibility('private')).toBe('private');
      expect(migrateLegacyVisibility('project-only')).toBe('team');
      expect(migrateLegacyVisibility('user-only')).toBe('personal');
      expect(migrateLegacyVisibility('public')).toBe('public');
    });

    it('returns null for unknown values', () => {
      expect(migrateLegacyVisibility('invalid')).toBeNull();
      expect(migrateLegacyVisibility('team')).toBeNull(); // Not a visibility value
    });
  });

  describe('migrateToUnifiedScope', () => {
    it('returns valid scopes unchanged', () => {
      expect(migrateToUnifiedScope('private')).toBe('private');
      expect(migrateToUnifiedScope('personal')).toBe('personal');
      expect(migrateToUnifiedScope('team')).toBe('team');
      expect(migrateToUnifiedScope('public')).toBe('public');
    });

    it('migrates legacy scope values', () => {
      expect(migrateToUnifiedScope('user')).toBe('personal');
      expect(migrateToUnifiedScope('project')).toBe('team');
      expect(migrateToUnifiedScope('shared')).toBe('team');
    });

    it('migrates legacy visibility values', () => {
      expect(migrateToUnifiedScope('project-only')).toBe('team');
      expect(migrateToUnifiedScope('user-only')).toBe('personal');
    });

    it('throws for non-string values', () => {
      expect(() => migrateToUnifiedScope(null)).toThrow('Cannot migrate non-string');
      expect(() => migrateToUnifiedScope(123)).toThrow('Cannot migrate non-string');
    });

    it('throws for unknown string values', () => {
      expect(() => migrateToUnifiedScope('invalid')).toThrow(
        'Cannot migrate unknown scope/visibility value: "invalid"'
      );
    });
  });
});
