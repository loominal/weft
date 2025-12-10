# Integration Tests

This directory contains end-to-end integration tests for the Loom coordinator system.

## Prerequisites

- NATS server running on `localhost:4222`
- All packages built (`npm run build` in each package)

## Test Scenarios

### Agent Registration Flow

1. Start NATS
2. Agent registers with warp MCP server
3. Verify agent appears in registry
4. Agent heartbeats
5. Agent deregisters
6. Verify agent is marked offline

### Work Queue Flow

1. Submit work via shuttle CLI
2. Agent claims work
3. Work completes
4. Results are reported
5. Verify status updates

### Target Management

1. Register a spin-up target
2. Assign agent to target
3. Verify target state
4. Unassign agent
5. Deregister target

### Failure Scenarios

1. Agent dies without deregistering (GC should clean up)
2. Work fails (should move to DLQ)
3. DLQ retry (should move back to work queue)

## Running Tests

```bash
# Start NATS server first
docker run -p 4222:4222 -p 8222:8222 nats:latest -js

# Run integration tests
npm run test:integration
```

## Test Structure

Tests use Vitest and are organized by feature:
- `agent-lifecycle.test.ts` - Agent registration and lifecycle
- `work-queue.test.ts` - Work submission and claiming
- `target-management.test.ts` - Target registration and linking
- `failure-scenarios.test.ts` - Error handling and recovery
