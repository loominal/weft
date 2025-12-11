#!/bin/bash
# GitHub Copilot CLI Agent Bootstrap Script
#
# This script starts a Copilot CLI agent that connects to the coordinator
# via NATS MCP tools (Warp).
#
# Prerequisites:
# - GitHub Copilot CLI installed (`gh copilot` command available)
# - MCP support enabled in Copilot CLI (preview feature)
# - Warp MCP server configured in Copilot's MCP settings
# - NATS server running and accessible
#
# Environment Variables:
#   NATS_URL                - NATS server URL (required)
#   LOOM_PROJECT_ID        - Project ID for namespace isolation (required)
#   AGENT_HANDLE            - Agent handle/username (default: copilot-agent-$HOSTNAME)
#   AGENT_CAPABILITIES      - Comma-separated capabilities (default: general)
#   AGENT_CLASSIFICATIONS   - Comma-separated classifications (default: corporate,corporate-adjacent)
#   IDLE_TIMEOUT_MS         - Idle timeout in ms (default: 300000)
#   WORK_DIR                - Working directory for tasks (default: current dir)
#   TARGET_NAME             - Name of the spin-up target this agent represents (optional)

set -euo pipefail

# Trap signals for graceful shutdown
trap 'echo "Received shutdown signal, cleaning up..."; exit 0' SIGTERM SIGINT

# Configuration with defaults
NATS_URL="${NATS_URL:?NATS_URL environment variable is required}"
LOOM_PROJECT_ID="${LOOM_PROJECT_ID:?LOOM_PROJECT_ID environment variable is required}"
AGENT_HANDLE="${AGENT_HANDLE:-copilot-agent-$(hostname)}"
AGENT_CAPABILITIES="${AGENT_CAPABILITIES:-general}"
AGENT_CLASSIFICATIONS="${AGENT_CLASSIFICATIONS:-corporate,corporate-adjacent}"
IDLE_TIMEOUT_MS="${IDLE_TIMEOUT_MS:-300000}"
WORK_DIR="${WORK_DIR:-$(pwd)}"
TARGET_NAME="${TARGET_NAME:-}"

echo "=== Copilot CLI Agent Bootstrap ==="
echo "  NATS URL: $NATS_URL"
echo "  Project ID: $LOOM_PROJECT_ID"
echo "  Handle: $AGENT_HANDLE"
echo "  Capabilities: $AGENT_CAPABILITIES"
echo "  Classifications: $AGENT_CLASSIFICATIONS"
echo "  Idle Timeout: ${IDLE_TIMEOUT_MS}ms"
echo "  Work Directory: $WORK_DIR"
echo "  Target Name: ${TARGET_NAME:-<none>}"
echo "===================================="

# Change to work directory
cd "$WORK_DIR"

# Check if Copilot CLI is available
if ! command -v gh &> /dev/null; then
  echo "ERROR: gh CLI not found. Please install GitHub CLI with Copilot extension."
  exit 1
fi

# Check if Copilot extension is installed
if ! gh copilot --help &> /dev/null 2>&1; then
  echo "ERROR: gh copilot extension not found."
  echo "Install with: gh extension install github/gh-copilot"
  exit 1
fi

# Check for Warp MCP configuration
# Note: The actual config location may vary. This is a placeholder check.
MCP_CONFIG_HINT="
To configure Warp MCP server for Copilot CLI:
1. Ensure Copilot CLI MCP support is enabled (preview feature)
2. Add loom-warp to your MCP configuration with:
   - NATS URL: $NATS_URL
   - Project ID: $LOOM_PROJECT_ID
3. Restart Copilot CLI

See Warp documentation for detailed MCP configuration instructions.
"

echo ""
echo "NOTE: Ensure Warp MCP is configured in Copilot CLI settings."
echo "$MCP_CONFIG_HINT"

# Build the initial prompt for Copilot CLI
INIT_PROMPT=$(cat <<EOF
You are a worker agent in a coordinated multi-agent system.

Your configuration:
- Handle: $AGENT_HANDLE
- Capabilities: $AGENT_CAPABILITIES
- Classifications: $AGENT_CLASSIFICATIONS
- Project ID: $LOOM_PROJECT_ID
- Target Name: ${TARGET_NAME:-<none>}
- Idle Timeout: ${IDLE_TIMEOUT_MS}ms

On startup, you MUST:
1. Set your handle using the MCP tool: set_handle("$AGENT_HANDLE")
2. Register as an agent using the MCP tool: register_agent({
     agentType: "copilot-cli",
     capabilities: ["${AGENT_CAPABILITIES//,/\", \"}"],
     allowedClassifications: ["${AGENT_CLASSIFICATIONS//,/\", \"}"],
     hostname: "$(hostname)",
     visibility: "project-only",
     spindownAfterIdleMs: $IDLE_TIMEOUT_MS
   })
3. If TARGET_NAME is set, link yourself to the target using the coordinator API
4. Start listening for work offers

Then continuously:
1. Check for work offers using read_direct_messages()
2. When you receive a work-offer message:
   - Send a work-claim response to the coordinator
   - Execute the task
   - Report progress periodically
   - Send completion or error when done
3. Monitor idle time and gracefully shutdown after ${IDLE_TIMEOUT_MS}ms of inactivity
4. Handle SIGTERM gracefully by completing current work and deregistering

Error handling:
- If registration fails, log the error and retry once after 5 seconds
- If connection to NATS is lost, attempt to reconnect
- On unrecoverable errors, deregister and exit with non-zero status

Start now by registering yourself.
EOF
)

# Start Copilot CLI with the initialization prompt
echo ""
echo "Starting Copilot CLI agent..."
echo ""

# Note: The exact command syntax may vary based on Copilot CLI version
# and MCP integration. Adjust as needed.
exec gh copilot suggest "$INIT_PROMPT"
