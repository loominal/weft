# Shuttle Dependencies on @loom/shared

This document lists all imports from `@loom/shared` used by Shuttle, for planning the repository split.

**Last Updated**: 2025-12-11
**Purpose**: Document dependencies for Phase 10 (repo split) planning

---

## Summary

Shuttle imports **6 types** and **1 constant** from `@loom/shared`:

| Import | Type | Source File | Used In |
|--------|------|-------------|---------|
| `CLIConfiguration` | Type | `types/config.ts` | `api/client.ts`, `utils/config-file.ts`, `commands/config.ts` |
| `DEFAULT_CLI_CONFIG` | Constant | `types/config.ts` | `utils/config-file.ts` |
| `Priority` | Type | `types/work-item.ts` | `commands/submit.ts`, `utils/prompts.ts` |
| `Boundary` | Type | `types/work-item.ts` | `commands/targets.ts`, `utils/prompts.ts` |
| `SpinUpMechanism` | Type | `types/spin-up-target.ts` | `commands/targets.ts`, `utils/prompts.ts` |
| `AgentType` | Type | `types/agent.ts` | `commands/targets.ts` |

---

## Detailed Import Analysis

### 1. `shuttle/src/api/client.ts`
```typescript
import type { CLIConfiguration } from '@loom/shared';
```
- Used for: Type annotation in API client constructor

### 2. `shuttle/src/utils/config-file.ts`
```typescript
import type { CLIConfiguration } from '@loom/shared';
import { DEFAULT_CLI_CONFIG } from '@loom/shared';
```
- Used for: Configuration file loading/saving
- `CLIConfiguration`: Type for config object
- `DEFAULT_CLI_CONFIG`: Default values when creating new config

### 3. `shuttle/src/commands/config.ts`
```typescript
import type { CLIConfiguration } from '@loom/shared';
```
- Used for: Type annotation in config command

### 4. `shuttle/src/commands/submit.ts`
```typescript
import type { Priority } from '@loom/shared';
```
- Used for: Type annotation for work priority

### 5. `shuttle/src/commands/targets.ts`
```typescript
import type { SpinUpMechanism, AgentType, Boundary } from '@loom/shared';
```
- Used for: Type annotations in target management commands

### 6. `shuttle/src/utils/prompts.ts`
```typescript
import type { Boundary, SpinUpMechanism, Priority } from '@loom/shared';
```
- Used for: Type annotations in interactive prompts

---

## Type Definitions Summary

### CLIConfiguration (types/config.ts)
```typescript
export interface CLIConfiguration {
  natsUrl: string;
  projectId: string;
  natsCredentials?: string;
  defaultBoundary?: string;
  defaultPriority?: number;
  outputFormat?: 'table' | 'json';
  apiUrl?: string;
  apiToken?: string;
}
```

### DEFAULT_CLI_CONFIG (types/config.ts)
```typescript
export const DEFAULT_CLI_CONFIG: Partial<CLIConfiguration> = {
  natsUrl: 'nats://localhost:4222',
  defaultPriority: 5,
  outputFormat: 'table',
};
```

### Priority (types/work-item.ts)
```typescript
export type Priority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
```

### Boundary (types/work-item.ts)
```typescript
export type Boundary = string;
```

### SpinUpMechanism (types/spin-up-target.ts)
```typescript
export type SpinUpMechanism = 'ssh' | 'github-actions' | 'local' | 'kubernetes' | 'webhook';
```

### AgentType (types/agent.ts)
```typescript
export type AgentType = 'claude' | 'copilot' | 'custom' | string;
```

---

## Impact Assessment

### Complexity: LOW
- All imports are simple type definitions or a single constant
- No complex runtime dependencies
- No NATS utilities are imported (Shuttle uses REST API)

### Migration Strategy
When Shuttle is split into its own repo, it will:
1. Install `@loom/shared` from npm instead of workspace
2. Change `"@loom/shared": "workspace:*"` to `"@loom/shared": "^0.1.0"`
3. No code changes required - imports remain identical

### Breaking Change Risk: NONE
- All types are simple aliases or interfaces
- No behavioral dependencies
- Version pinning with `^0.1.0` allows patch updates

---

## Files to Watch

If these shared types change, Shuttle may need updates:
- `shared/src/types/config.ts` - CLIConfiguration, DEFAULT_CLI_CONFIG
- `shared/src/types/work-item.ts` - Priority, Boundary
- `shared/src/types/spin-up-target.ts` - SpinUpMechanism
- `shared/src/types/agent.ts` - AgentType
