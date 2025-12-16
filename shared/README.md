# @loominal/shared

Shared types and utilities for the Loominal multi-agent infrastructure.

## Installation

```bash
npm install @loominal/shared
# or
pnpm add @loominal/shared
```

## Exports

The package provides three entry points:

```typescript
// All exports (types + NATS utilities)
import { LoominalScope, NATSClient } from '@loominal/shared';

// Types only
import { LoominalScope, RegisteredAgent } from '@loominal/shared/types';

// NATS utilities only
import { NATSClient, createSubjectPatterns } from '@loominal/shared/nats';
```

---

## Unified Scope Model

Loominal uses a consistent 4-value scope model across all components (Pattern, Warp, Weft):

```typescript
type LoominalScope = 'private' | 'personal' | 'team' | 'public';
```

### Scope Definitions

| Scope | Who Can Access | Where Stored | Use Case |
|-------|----------------|--------------|----------|
| `private` | Just this agent, this project | Project bucket, agent-keyed | Task-specific notes, session state |
| `personal` | Just this agent, everywhere | User bucket, agent-keyed | User preferences, schedules, personal profile |
| `team` | All agents in this project | Project bucket, shared | Project decisions, architecture, team learnings |
| `public` | All agents everywhere | Global bucket, shared | Public announcements, cross-project coordination |

### Visual Model

```
                    ┌─────────────────────────────────────────────┐
                    │              Global Bucket                   │
                    │           (loom-global-{feature})            │
                    │                                              │
                    │   public scope: all agents, all projects    │
                    └─────────────────────────────────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   User Bucket A     │     │   User Bucket B     │     │   User Bucket C     │
│ (loom-user-agent-a) │     │ (loom-user-agent-b) │     │ (loom-user-agent-c) │
│                     │     │                     │     │                     │
│ personal scope:     │     │ personal scope:     │     │ personal scope:     │
│ follows user across │     │ follows user across │     │ follows user across │
│ projects            │     │ projects            │     │ projects            │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
          │                               │                               │
          ▼                               ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Project Bucket                                    │
│                      (loom-{feature}-{projectId})                           │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        team scope (shared.)                          │   │
│   │                                                                      │   │
│   │   Visible to all agents in this project                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │ private scope   │   │ private scope   │   │ private scope   │          │
│   │ (agent.A.)      │   │ (agent.B.)      │   │ (agent.C.)      │          │
│   │                 │   │                 │   │                 │          │
│   │ Only Agent A    │   │ Only Agent B    │   │ Only Agent C    │          │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Default Scopes by Operation

| Operation Type | Default Scope | Rationale |
|----------------|---------------|-----------|
| Agent registration | `team` | Agents are discoverable within their project |
| Work offers | `team` | Work is distributed within the project |
| Channel messages | `team` | Project communication |
| Task memories | `private` | Task-specific, session-bound |
| Core memories | `personal` | Identity follows the user across projects |
| Project decisions | `team` | Shared project knowledge |

### Bucket Naming Helpers

```typescript
import {
  getUserBucket,
  getProjectBucket,
  getGlobalBucket,
  selectBucket,
} from '@loominal/shared/types';

// User bucket for personal scope
getUserBucket('agent-123');
// → 'loom-user-agent-123'

// Project bucket for private/team scope
getProjectBucket('pattern', 'abc123');
// → 'loom-pattern-abc123'

// Global bucket for public scope
getGlobalBucket('pattern');
// → 'loom-global-pattern'

// Automatic bucket selection based on scope
selectBucket('personal', {
  feature: 'pattern',
  agentId: 'agent-123',
  projectId: 'project-abc',
});
// → { bucket: 'loom-user-agent-123', keyPrefix: 'pattern.' }
```

### Migration from Legacy Values

If you're migrating from older versions of Loominal components:

```typescript
import { migrateToUnifiedScope } from '@loominal/shared/types';

// Pattern legacy values
migrateToUnifiedScope('user');    // → 'personal'
migrateToUnifiedScope('project'); // → 'team'
migrateToUnifiedScope('shared');  // → 'team'

// Warp legacy visibility values
migrateToUnifiedScope('private');      // → 'private'
migrateToUnifiedScope('project-only'); // → 'team'
migrateToUnifiedScope('user-only');    // → 'personal'
migrateToUnifiedScope('public');       // → 'public'
```

**Migration mapping:**

| Old Value (Pattern) | Old Value (Warp) | New Unified Value |
|---------------------|------------------|-------------------|
| `scope: "private"` + `category: "core"` | - | `personal` |
| `scope: "private"` + other categories | `visibility: "private"` | `private` |
| `scope: "shared"` | `visibility: "project-only"` | `team` |
| - | `visibility: "user-only"` | `personal` |
| - | `visibility: "public"` | `public` |

---

## Type Reference

### Scope Types

```typescript
// The unified scope type
type LoominalScope = 'private' | 'personal' | 'team' | 'public';

// Context for bucket selection
interface BucketSelectionContext {
  feature: string;   // e.g., 'pattern', 'warp'
  agentId: string;   // Agent's unique identifier
  projectId: string; // Project identifier
}

// Result of bucket selection
interface BucketSelection {
  bucket: string;      // The bucket name
  keyPrefix?: string;  // Optional key prefix within bucket
}
```

### Agent Types

```typescript
type AgentStatus = 'online' | 'busy' | 'offline';
type AgentType = 'copilot-cli' | 'claude-code';

interface RegisteredAgent {
  guid: string;
  handle: string;
  agentType: AgentType;
  status: AgentStatus;
  capabilities: string[];
  boundaries: Boundary[];
  hostname: string;
  projectId: string;
  visibility: AgentVisibility;  // Legacy, prefer 'scope'
  // ... other fields
}
```

### Work Item Types

```typescript
type Boundary = 'corporate' | 'corporate-adjacent' | 'personal' | 'open-source';
type WorkItemStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed';
type Priority = 'low' | 'normal' | 'high' | 'critical';

interface BaseWorkItem {
  id: string;
  description: string;
  boundary: Boundary;
  priority: Priority;
  requiredCapabilities: string[];
  // ... other fields
}
```

---

## NATS Utilities

### Subject Patterns

```typescript
import { createSubjectPatterns } from '@loominal/shared/nats';

const subjects = createSubjectPatterns('my-project-id');

// Channel subjects
subjects.channels.publish('roadmap');     // → 'loom.my-project-id.channels.roadmap'
subjects.channels.subscribe('*');         // → 'loom.my-project-id.channels.*'

// Registry subjects
subjects.registry.put;                    // → 'loom.my-project-id.registry.put'
subjects.registry.get;                    // → 'loom.my-project-id.registry.get'

// Work subjects
subjects.work.offer('typescript');        // → 'loom.my-project-id.work.typescript'
```

### NATS Client

```typescript
import { NATSClient } from '@loominal/shared/nats';

const client = new NATSClient({
  url: 'nats://localhost:4222',
  projectId: 'my-project',
});

await client.connect();

// Publish to channel
await client.publish(subjects.channels.publish('roadmap'), {
  type: 'update',
  content: 'Sprint planning complete',
});

// Subscribe to channel
const sub = await client.subscribe(subjects.channels.subscribe('*'));
for await (const msg of sub) {
  console.log('Received:', msg.data);
}
```

---

## License

MIT
