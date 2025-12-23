# Weft WebSocket Examples

This directory contains working examples demonstrating how to use the Weft WebSocket API for real-time event monitoring.

## Prerequisites

### JavaScript/Node.js Examples

Install the `ws` WebSocket library:

```bash
npm install ws
```

Or if using pnpm (from the weft root):

```bash
cd examples/websocket
pnpm install ws
```

### Python Example

Install the `websockets` library:

```bash
pip install websockets
```

## Running the Examples

Make sure Weft is running first:

```bash
# From the weft root directory
docker-compose up -d
# or
pnpm dev
```

Verify Weft is running:

```bash
curl http://localhost:3000/health
```

### Subscribe to Work Events

Monitor work queue activity in real-time:

```bash
node subscribe-work.js
```

This script subscribes to all work events and displays:
- Work submissions
- Work assignments
- Progress updates
- Completions and failures

### Subscribe to Agent Events

Monitor agent lifecycle events:

```bash
node subscribe-agents.js
```

This script tracks:
- Agent registrations
- Status changes (online, busy, offline)
- Agent shutdowns

### Real-Time Dashboard

View a comprehensive dashboard with all topics:

```bash
node subscribe-all.mjs
```

This script shows:
- Agent statistics
- Work queue depth
- Target availability
- Recent events (last 10)
- Periodic stats updates (every 30s)

### Python Client

Python example with the same functionality as subscribe-work.js:

```bash
python3 python-client.py
```

## Custom WebSocket URL

All examples accept a custom WebSocket URL as the first argument:

```bash
# Connect to a different host
node subscribe-work.js ws://weft.example.com/api/ws

# Connect with authentication token
node subscribe-work.js ws://localhost:3000/api/ws?token=my-secret-token

# Python example with custom URL
python3 python-client.py ws://localhost:3000/api/ws
```

## Making Scripts Executable

To run scripts without the `node` prefix:

```bash
chmod +x subscribe-work.js subscribe-agents.js subscribe-all.mjs python-client.py

# Then run directly
./subscribe-work.js
./subscribe-agents.js
./subscribe-all.mjs
./python-client.py
```

## Customizing the Examples

### Filter by Status

Edit the subscribe message to filter events:

```javascript
// In subscribe-work.js, replace the subscription:
ws.send(JSON.stringify({
  type: 'subscribe',
  topic: 'work',
  filter: { status: 'pending' }  // Only show pending work
}));
```

### Filter by Capability

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  topic: 'work',
  filter: { capability: 'typescript' }  // Only show TypeScript work
}));
```

### Multiple Filters

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  topic: 'work',
  filter: {
    capability: 'typescript',
    boundary: 'personal',
    status: 'pending'
  }
}));
```

### Subscribe to Multiple Topics

```javascript
const topics = ['work', 'agents', 'targets', 'stats'];
topics.forEach(topic => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic
  }));
});
```

## Troubleshooting

### Connection Refused

**Error:** `ECONNREFUSED`

**Solution:**
1. Verify Weft is running: `curl http://localhost:3000/health`
2. Check the WebSocket URL is correct (default: `ws://localhost:3000/api/ws`)
3. Ensure no firewall blocking port 3000

### Authentication Error

**Error:** Connection closes immediately after opening

**Solution:**
- Check if Weft has `API_TOKENS` configured
- If yes, pass token in URL: `ws://localhost:3000/api/ws?token=your-token`
- Check Weft logs for authentication errors

### No Events Received

**Problem:** Connected and subscribed, but no events appear

**Solution:**
1. Verify subscription was acknowledged (look for "Subscribed to topic" message)
2. Trigger a test event (submit work via REST API or Shuttle CLI)
3. Check if filters are too restrictive
4. Ensure you're subscribed to the correct topic for the event type

### Module Not Found (JavaScript)

**Error:** `Cannot find module 'ws'`

**Solution:**
```bash
npm install ws
# or
pnpm install ws
```

### Module Not Found (Python)

**Error:** `ModuleNotFoundError: No module named 'websockets'`

**Solution:**
```bash
pip install websockets
```

## Generating Test Events

To see the examples in action, generate some events:

### Submit Work (using curl)

```bash
curl -X POST http://localhost:3000/api/work \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "example-task",
    "capability": "typescript",
    "boundary": "personal",
    "priority": 5,
    "description": "Test work item"
  }'
```

### Using Shuttle CLI

If you have Shuttle installed:

```bash
shuttle work submit \
  --task-id example-task \
  --capability typescript \
  --boundary personal \
  --description "Test work item"
```

## Next Steps

- Read the [WebSocket API Documentation](../../WEBSOCKET_API.md) for complete protocol details
- Explore the [REST API](../../README.md#rest-api) for complementary functionality
- Build your own monitoring tools using these examples as templates

## Example Output

### subscribe-work.js

```
Connecting to Weft WebSocket at ws://localhost:3000/api/ws...
✓ Connected to Weft

Subscribing to work events...
✓ Subscribed to topic: work

Waiting for work events...

[14:32:15] work:submitted
  Task ID: example-task
  Capability: typescript
  Boundary: personal
  Priority: 5
  Description: Test work item

[14:32:16] work:assigned
  Task ID: example-task
  Assigned to: claude-code
  Capability: typescript

[14:32:45] work:completed
  Task ID: example-task
  Summary: Task completed successfully
```

### subscribe-all.mjs

```
╔════════════════════════════════════════════════════════════════╗
║                    Weft Real-Time Dashboard                    ║
╚════════════════════════════════════════════════════════════════╝

📊 AGENTS
   Total: 3
   Online: 2  Busy: 1  Offline: 0

📋 WORK
   Pending: 5  Active: 2
   Completed: 42  Failed: 1

🎯 TARGETS
   Total: 4
   Available: 3  In-Use: 1  Disabled: 0

🔌 WEBSOCKET
   Connections: 2  Subscriptions: 8

📡 RECENT EVENTS
   [14:32:45] work:completed
      Task: example-task
   [14:32:16] work:assigned
      Task: example-task → claude-code
   [14:32:15] work:submitted
      Task: example-task (typescript)

Last update: 14:32:45

Press Ctrl+C to exit
```

## Contributing

Found a bug or have an improvement? Please open an issue or submit a pull request!
