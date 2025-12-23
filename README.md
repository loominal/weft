# Weft

**Intelligent coordination for Loominal.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Beta](https://img.shields.io/badge/Status-Beta-blue.svg)](https://github.com/loominal/weft/releases)

This package contains the orchestration layer for [Loominal](https://github.com/loominal/loominal) — the coordinator service that weaves work through your agent fabric.

> **Note**: The Shuttle CLI has been moved to its own repository: **[shuttle](https://github.com/loominal/shuttle)**

> **🔷 Beta Software**: This project has passed integration testing and is suitable for early adopters. While core functionality is stable, some features may still change. Feedback and contributions are welcome!

> **Weft** (noun): In weaving, the weft threads are the horizontal threads that weave through the warp, creating the pattern.

## Overview

| Component | Purpose | Repository |
|-----------|---------|------------|
| **Weft** | Coordinator service — routes work, manages agent lifecycle, handles scaling | This repo |
| **Shuttle** | CLI tool — submit work, manage agents, monitor your fleet | [shuttle](https://github.com/loominal/shuttle) |

Together they enable:
- **Work routing** based on data classification (corporate vs personal)
- **Dynamic agent spin-up** when work arrives and no agents are available
- **Automatic scale-down** of idle agents
- **Fleet management** from the command line

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NATS JetStream                                    │
│                    Channels • Work Queues • KV Stores                       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   Agent 1     │          │   Agent 2     │          │   Agent N     │
│   + Warp      │          │   + Warp      │          │   + Warp      │
│   (MCP)       │          │   (MCP)       │          │   (MCP)       │
└───────────────┘          └───────────────┘          └───────────────┘

                    ┌───────────────────────────┐
                    │          WEFT             │
                    │      (Coordinator)        │
                    ├───────────────────────────┤
                    │ • Work Routing            │
                    │ • Target Registry         │
                    │ • Spin-up Manager         │
                    │ • Idle Tracker            │
                    │ • REST API (:3000)        │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │        SHUTTLE            │
                    │         (CLI)             │
                    └───────────────────────────┘
```

Weft connects to NATS directly (not through Warp) and coordinates agent lifecycle. Shuttle communicates with Weft via REST API.

## Work Classification

| Classification | Description | Routed To |
|----------------|-------------|-----------|
| `corporate` | Requires access to corporate systems/data | Copilot CLI only |
| `corporate-adjacent` | Work-related but no sensitive data | Copilot preferred |
| `personal` | Personal projects | Claude Code preferred |
| `open-source` | Public repositories | Any agent |

## Quick Start

### 1. Start NATS and Weft

**Option A: Docker Compose (easiest)**

```bash
docker-compose up -d
```

**Option B: Pull from GitHub Container Registry**

```bash
# Start NATS
docker run -d --name nats -p 4222:4222 nats:latest -js

# Start Weft
docker run -d --name weft \
  -p 3000:3000 \
  -e NATS_URL=nats://host.docker.internal:4222 \
  ghcr.io/loominal/weft:latest
```

### 2. Verify Weft is Running

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### 3. Use Shuttle CLI (Optional)

Install the [Shuttle CLI](https://github.com/loominal/shuttle) for fleet management:

```bash
npm install -g @loominal/shuttle
shuttle config set nats-url nats://localhost:4222
shuttle agents list
```

## Multi-Tenant Architecture

Weft supports multiple projects in a single deployment. Projects are auto-discovered when agents or clients first connect.

- Single Weft instance handles all projects via NATS wildcard subscriptions (`coord.*.*`)
- Each project gets isolated: coordinator, target registry, idle tracker
- Global stats endpoint shows aggregate metrics across all projects

## Shuttle CLI

For CLI documentation, see **[shuttle](https://github.com/loominal/shuttle)**.

## Spin-Up Mechanisms

Weft supports multiple ways to spin up agents:

| Mechanism | Use Case |
|-----------|----------|
| **SSH** | Spin up agents on remote servers via SSH |
| **Local** | Spawn local processes |
| **Kubernetes** | Create K8s Jobs for containerized agents |
| **GitHub Actions** | Trigger workflow dispatches |
| **Webhook** | Call custom endpoints |

### SSH Example

```bash
shuttle targets add \
  --name home-server \
  --type claude-code \
  --mechanism ssh \
  --host 192.168.1.100 \
  --user developer \
  --key ~/.ssh/id_rsa \
  --command "~/start-agent.sh"
```

### Kubernetes Example

```bash
shuttle targets add \
  --name k8s-agent \
  --type claude-code \
  --mechanism kubernetes \
  --namespace agents \
  --image ghcr.io/myorg/claude-agent:latest \
  --service-account agent-sa
```

## Packages

| Package | Description |
|---------|-------------|
| `@loominal/shared` | Shared types and NATS utilities |
| `@loominal/weft` | Coordinator service |

## Agent Wrappers

Both Claude Code and GitHub Copilot CLI connect to Loominal via Warp (MCP server). Bootstrap scripts handle agent registration and work queue subscription.

### Claude Code

Use the bootstrap script to start a Claude Code agent:

```bash
NATS_URL=nats://localhost:4222 \
PROJECT_ID=my-project \
AGENT_CAPABILITIES=typescript,python \
./agent-wrappers/claude-code/bootstrap.sh
```

### Copilot CLI

Use the bootstrap script to start a Copilot CLI agent:

```bash
NATS_URL=nats://localhost:4222 \
PROJECT_ID=my-project \
AGENT_CAPABILITIES=typescript,python \
./agent-wrappers/copilot-cli/bootstrap.sh
```

> **Note**: Copilot CLI requires MCP support (preview feature). Ensure Warp is configured as an MCP server in your Copilot CLI settings.

## Configuration

### Environment Variables (Weft)

| Variable | Description | Default |
|----------|-------------|---------|
| `NATS_URL` | NATS server URL (supports credentials in URL) | `nats://localhost:4222` |
| `NATS_USER` | Username for NATS authentication (fallback if not in URL) | (none) |
| `NATS_PASS` | Password for NATS authentication (fallback if not in URL) | (none) |
| `LOOMINAL_PROJECT_ID` | Project ID for isolation | `default` |
| `API_PORT` | REST API port | `3000` |
| `API_HOST` | REST API host | `0.0.0.0` |
| `API_TOKENS` | Comma-separated bearer tokens for API authentication | (none) |
| `IDLE_TIMEOUT_MS` | Idle detection timeout | `300000` |
| `LOG_LEVEL` | Logging level | `info` |

**NATS Connection Behavior:**
- Automatic reconnection enabled with unlimited attempts
- Fixed 2-second delay between reconnection attempts
- Connection state changes are logged for monitoring

### NATS Authentication

Authentication is **optional**. For local development, just use `nats://localhost:4222`.

For production NATS servers with authentication enabled:

**Option 1: Credentials in URL (recommended)**
```bash
NATS_URL=nats://admin:mypassword@nats.example.com:4222
```

**Option 2: Separate environment variables**
```bash
NATS_URL=nats://nats.example.com:4222
NATS_USER=admin
NATS_PASS=mypassword
```

URL credentials take precedence over environment variables. Special characters in passwords should be URL-encoded (e.g., `@` → `%40`, `/` → `%2F`).

### WebSocket Transport

Weft supports WebSocket connections for environments where raw TCP is not available (e.g., through CDN proxies like Cloudflare):

```bash
# WebSocket (for proxied connections)
NATS_URL=wss://admin:mypassword@nats.example.com

# WebSocket without TLS (local testing only)
NATS_URL=ws://localhost:8080
```

The transport is auto-detected from the URL scheme:
- `nats://` or `tls://` → TCP connection
- `ws://` or `wss://` → WebSocket connection

### Shuttle Configuration

Stored in `~/.loominal/config.json`:

```json
{
  "natsUrl": "nats://localhost:4222",
  "projectId": "my-project",
  "defaultClassification": "personal",
  "outputFormat": "table"
}
```

## REST API

Weft exposes a REST API for integration:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/agents` | GET | List agents |
| `/api/agents/:guid` | GET | Get agent details |
| `/api/agents/:guid/shutdown` | POST | Request agent shutdown |
| `/api/work` | GET | List work items |
| `/api/work` | POST | Submit work |
| `/api/work/:id` | GET | Get work item |
| `/api/work/:id/cancel` | POST | Cancel work item |
| `/api/targets` | GET | List targets |
| `/api/targets` | POST | Register target |
| `/api/targets/:id` | GET | Get target details |
| `/api/targets/:id` | PUT | Update target |
| `/api/targets/:id` | DELETE | Remove target |
| `/api/targets/:id/test` | POST | Test target health |
| `/api/targets/:id/spin-up` | POST | Trigger target spin-up |
| `/api/targets/:id/disable` | POST | Disable target |
| `/api/targets/:id/enable` | POST | Enable target |
| `/api/stats` | GET | Coordinator stats |
| `/api/stats/projects` | GET | List active projects |
| `/api/channels` | GET | List channels (requires `projectId` query param) |
| `/api/channels/:name/messages` | GET | Read channel messages (requires `projectId` query param) |

## WebSocket API

Weft provides a WebSocket API for real-time updates on agent status, work distribution, and system events.

### Quick Start

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  // Subscribe to work events
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'work'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'event') {
    console.log(`[${msg.event}] ${msg.data.taskId}`);
  }
});
```

### Features

- **Real-time events** - Get instant notifications for agent, work, and target changes
- **Server-side filtering** - Subscribe to specific event types and filter by status, capability, boundary, etc.
- **Low latency** - <10ms from event emission to client receipt
- **Automatic heartbeat** - Built-in connection health monitoring
- **Periodic stats** - Optional statistics updates every 30 seconds

### Topics

| Topic | Events | Description |
|-------|--------|-------------|
| `work` | 7 events | Work submission, assignment, progress, completion |
| `agents` | 3 events | Agent registration, status updates, shutdown |
| `targets` | 5 events | Target configuration, health, spin-up events |
| `stats` | Periodic | System statistics every 30 seconds |

### Event Types (19 total)

**Work Events:**
`work:submitted`, `work:assigned`, `work:started`, `work:progress`, `work:completed`, `work:failed`, `work:cancelled`

**Agent Events:**
`agent:registered`, `agent:updated`, `agent:shutdown`

**Target Events:**
`target:registered`, `target:updated`, `target:disabled`, `target:removed`, `target:health-changed`

**Spin-Up Events:**
`spin-up:triggered`, `spin-up:started`, `spin-up:completed`, `spin-up:failed`

### Complete Documentation

For complete protocol specification, message formats, code examples, and best practices:

- **[WebSocket API Documentation](./WEBSOCKET_API.md)** - Complete API guide
- **[Example Scripts](./examples/websocket/)** - Working code examples in JavaScript and Python

## Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for NATS)

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### Project Structure

```
weft/
├── shared/                 # @loominal/shared - Types and utilities
├── weft/                   # @loominal/weft - Coordinator service
├── agent-wrappers/
│   ├── claude-code/        # Claude Code bootstrap scripts
│   └── copilot-cli/        # Copilot CLI bootstrap scripts
├── docker-compose.yml
└── README.md
```

## Security

Weft is designed for trusted network environments. Consider these security practices:

### Authentication and Authorization
- **REST API**: Currently unauthenticated - deploy behind a reverse proxy with authentication for production
- **NATS**: Supports TLS and credential-based authentication via config file
- **SSH Keys**: Use key-based authentication for SSH spin-up targets
- **API Tokens**: Store GitHub/webhook tokens securely using environment variables or secrets management

### Network Security
- Deploy NATS and Weft on a private network or use TLS for NATS connections
- Use firewall rules to restrict API access to trusted clients
- Consider using VPN or SSH tunnels for remote agent connections

### Secrets Management
- Never commit SSH keys, API tokens, or credentials to version control
- Use environment variables or dedicated secrets managers (HashiCorp Vault, AWS Secrets Manager, etc.)
- For Kubernetes deployments, use Kubernetes Secrets with RBAC controls

### Best Practices
- Regularly rotate SSH keys and API tokens
- Monitor audit logs for unusual activity
- Use least-privilege principles for service accounts
- Keep dependencies up to date to patch security vulnerabilities

## Known Limitations

This is **beta software** ready for early adopters. Known limitations include:

### Scalability
- Single-node deployment only (no HA/clustering yet)
- Target registry stored in-memory (lost on restart)
- No persistent work queue (work items lost if Weft crashes)

### Features
- No authentication/authorization on REST API
- No work prioritization across projects in multi-tenant mode
- Limited observability (metrics/tracing not yet implemented)
- No automatic target health checking (manual test only)

### Agent Management
- Idle detection relies on work completion events (agents may stay running if busy with non-Loominal work)
- No graceful shutdown coordination for in-progress work during Weft restart
- SSH-based spin-up assumes agents can reach NATS (no NAT traversal)

### Platform Support
- Kubernetes spin-up tested on standard K8s only (not OpenShift, EKS variants, etc.)
- GitHub Actions spin-up requires public/private repo access (no fine-grained PAT support yet)
- Local spin-up mechanism assumes Unix-like shell environment

### Roadmap
We're actively working on addressing these limitations. See the main [Loominal README](https://github.com/loominal/loominal) for the project roadmap.

## Related

- [Loominal](https://github.com/loominal/loominal) — Multi-agent infrastructure
- [Warp](https://github.com/loominal/warp) — MCP server for messaging
- [Pattern](https://github.com/loominal/pattern) — Agent memory
- [Shuttle](https://github.com/loominal/shuttle) — Fleet management CLI

## License

MIT
