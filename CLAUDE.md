# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Weft** is the coordination layer for the Loominal multi-agent infrastructure. It routes work, manages agent lifecycle, handles scaling, and provides a REST API for fleet management. Weft runs as a multi-tenant service that handles multiple projects in a single deployment.

This repository is a pnpm monorepo containing:
- `weft/` - The coordinator service (`@loominal/weft`)
- `shared/` - Shared types and NATS utilities (`@loominal/shared`)

## Build and Development Commands

```bash
# Install dependencies (uses pnpm workspaces)
pnpm install

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Clean build artifacts
pnpm clean
```

### Per-Package Commands

```bash
# Build a specific package
cd weft && pnpm build

# Run tests for a specific package
cd weft && pnpm test

# Watch mode for tests
cd weft && pnpm test:watch

# Development mode with hot reload
cd weft && pnpm dev
```

### Running the Service

```bash
# Start with Docker Compose (includes NATS)
docker-compose up -d

# Or run directly after build
cd weft && pnpm start

# Environment variables
NATS_URL=nats://localhost:4222
LOOMINAL_PROJECT_ID=my-project
API_PORT=3000
```

## Architecture

### Core Components (in `weft/weft/src/`)

| Component | Path | Purpose |
|-----------|------|---------|
| **Service** | `service.ts` | Main entry point, multi-tenant orchestration, NATS handlers |
| **Coordinator** | `coordinator/` | Work routing, agent registry, assignment tracking |
| **Target Registry** | `targets/` | Manages spin-up targets (SSH, K8s, local, webhook, GitHub Actions) |
| **Spin-Up Manager** | `spin-up/` | Agent lifecycle and dynamic spin-up execution |
| **Idle Tracker** | `idle/` | Detects idle agents for scale-down |
| **Routing Engine** | `routing/` | Work classification and agent matching based on boundaries |
| **REST API** | `api/` | Express server with routes for agents, work, targets, stats |
| **Project Manager** | `projects/` | Multi-tenant project isolation and context management |

### Multi-Tenant Design

- Single Weft instance handles all projects via NATS wildcard subscriptions (`coord.*.*`)
- Each project gets isolated: coordinator, target registry, idle tracker
- Projects are auto-discovered when agents or clients first connect

### NATS Subject Patterns

- `coord.<projectId>.stats` - Project statistics
- `coord.<projectId>.agents.*` - Agent operations
- `coord.<projectId>.work.*` - Work submission/tracking
- `coord.<projectId>.targets.*` - Target management
- `coord.global.stats` - Cross-project statistics
- `coord.global.projects` - List active projects

### Spin-Up Mechanisms

Located in `spin-up/mechanisms/`:
- `ssh.ts` - Remote server spin-up via SSH
- `kubernetes.ts` - K8s Job creation
- `local.ts` - Local process spawning
- `github-actions.ts` - Workflow dispatch triggers
- `webhook.ts` - Custom endpoint calls

## Testing

Tests use Vitest and are located alongside source files in `__tests__/` directories.

```bash
# Run all tests
pnpm test

# Run specific test file
cd weft && pnpm vitest run src/routing/__tests__/engine.test.ts

# Watch mode
cd weft && pnpm test:watch

# Run tests with coverage (in warp/pattern repos, not weft)
pnpm run test:coverage
```

## Related Loominal Repositories

| Repo | Purpose | Local Path |
|------|---------|------------|
| [warp](https://github.com/loominal/warp) | MCP server for NATS messaging | `../warp` |
| [pattern](https://github.com/loominal/pattern) | MCP server for agent memory | `../pattern` |
| [tools](https://github.com/loominal/tools) | Docker images and utilities | `../tools` |
| [shuttle](https://github.com/loominal/shuttle) | Fleet management CLI | (separate repo) |

## Key Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_URL` | `nats://localhost:4222` | NATS server URL (supports credentials in URL) |
| `LOOMINAL_PROJECT_ID` | `default` | Default project for isolation |
| `API_PORT` | `3000` | REST API port |
| `API_HOST` | `0.0.0.0` | REST API bind address |
| `API_TOKENS` | (none) | Comma-separated bearer tokens for API auth |
| `IDLE_TIMEOUT_MS` | `300000` | Idle detection timeout |
| `LOG_LEVEL` | `info` | Logging level |

### Work Classification Boundaries

| Classification | Description |
|----------------|-------------|
| `corporate` | Requires corporate systems/data access |
| `corporate-adjacent` | Work-related but no sensitive data |
| `personal` | Personal projects |
| `open-source` | Public repositories |

## REST API Endpoints

Key endpoints (all under `/api/`):
- `GET /health` - Health check
- `GET /agents` - List agents
- `POST /work` - Submit work
- `GET /targets` - List spin-up targets
- `POST /targets/:id/spin-up` - Trigger agent spin-up
- `GET /stats` - Coordinator statistics
- `GET /stats/projects` - List active projects
