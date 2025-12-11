# Copilot CLI Agent Wrapper

Bootstrap scripts for running GitHub Copilot CLI as a Loom agent.

## Prerequisites

1. **GitHub CLI** with Copilot extension installed:
   ```bash
   # Install GitHub CLI
   brew install gh  # or your package manager

   # Install Copilot extension
   gh extension install github/gh-copilot
   ```

2. **MCP Support** enabled in Copilot CLI (preview feature)

3. **Warp MCP Server** configured in Copilot's MCP settings

## MCP Configuration

Copilot CLI needs Warp configured as an MCP server to communicate with NATS.

Add Warp to your Copilot CLI MCP configuration:

```json
{
  "servers": {
    "loom-warp": {
      "command": "npx",
      "args": ["@loom/warp"],
      "env": {
        "NATS_URL": "nats://localhost:4222",
        "LOOM_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

> **Note**: The exact configuration location and format may vary based on
> Copilot CLI version. Consult GitHub Copilot CLI documentation for MCP setup.

## Usage

### Direct Execution

```bash
NATS_URL=nats://localhost:4222 \
LOOM_PROJECT_ID=my-project \
AGENT_CAPABILITIES=typescript,python \
./bootstrap.sh
```

### As a Spin-Up Target

Register as a target in Weft:

```bash
shuttle targets add \
  --name work-copilot \
  --type copilot-cli \
  --mechanism local \
  --command "/path/to/agent-wrappers/copilot-cli/bootstrap.sh" \
  --capabilities typescript,python \
  --classifications corporate,corporate-adjacent
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NATS_URL` | Yes | - | NATS server URL |
| `LOOM_PROJECT_ID` | Yes | - | Project ID for isolation |
| `AGENT_HANDLE` | No | `copilot-agent-$HOSTNAME` | Agent handle |
| `AGENT_CAPABILITIES` | No | `general` | Comma-separated capabilities |
| `AGENT_CLASSIFICATIONS` | No | `corporate,corporate-adjacent` | Allowed work classifications |
| `IDLE_TIMEOUT_MS` | No | `300000` | Idle timeout before shutdown |
| `WORK_DIR` | No | Current directory | Working directory |
| `TARGET_NAME` | No | - | Spin-up target name |

## Differences from Claude Code

- **Default classifications**: `corporate,corporate-adjacent` (vs Claude Code's `personal,open-source`)
- **Agent type**: `copilot-cli` (used for work routing)
- **MCP configuration**: Different config file location/format than Claude Code

## Troubleshooting

### "gh copilot extension not found"
Install the Copilot extension:
```bash
gh extension install github/gh-copilot
```

### MCP tools not working
1. Verify MCP support is enabled in Copilot CLI
2. Check Warp is properly configured in MCP settings
3. Verify NATS is running and accessible
4. Check Warp logs for connection errors
