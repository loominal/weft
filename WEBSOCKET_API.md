# Weft WebSocket API

## Overview

The Weft WebSocket API provides real-time updates for agent lifecycle, work distribution, and target management events. Connect once and receive instant notifications as your multi-agent system operates.

**Use Cases:**
- Build real-time dashboards monitoring agent status
- Track work queue depth and assignment patterns
- Monitor target health and spin-up events
- Debug multi-agent coordination in real-time
- Create custom alerting on system events

## Quick Start

### JavaScript/Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected to Weft');

  // Subscribe to work events
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'work',
    filter: { status: 'pending' }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);

  if (message.type === 'event') {
    console.log(`[${message.event}] Task: ${message.data.taskId}`);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from Weft');
});
```

### Python

```python
import asyncio
import websockets
import json

async def subscribe_to_work():
    uri = "ws://localhost:3000/api/ws"

    async with websockets.connect(uri) as ws:
        # Subscribe to work events
        await ws.send(json.dumps({
            "type": "subscribe",
            "topic": "work"
        }))

        # Receive events
        async for message in ws:
            data = json.loads(message)

            if data['type'] == 'event':
                print(f"Event: {data['event']}")
                print(f"Data: {data['data']}")

asyncio.run(subscribe_to_work())
```

### curl (WebSocket client)

```bash
# Install websocat for command-line WebSocket testing
# https://github.com/vi/websocat
websocat ws://localhost:3000/api/ws
```

Then send JSON messages:
```json
{"type":"subscribe","topic":"work"}
```

## Connection

**Development:** `ws://localhost:3000/api/ws`
**Production:** `wss://weft.example.com/api/ws`

### Authentication

Authentication is currently **optional** but recommended for production deployments.

**Method 1: Query parameter** (recommended)
```
ws://localhost:3000/api/ws?token=your-secret-token
```

**Method 2: Sec-WebSocket-Protocol header**
```javascript
new WebSocket('ws://localhost:3000/api/ws', ['bearer', 'your-secret-token']);
```

Configure accepted tokens via the `API_TOKENS` environment variable:
```bash
API_TOKENS=token1,token2,token3
```

### Connection Lifecycle

1. **Connect** - Open WebSocket connection
2. **Subscribe** - Send subscribe messages for topics of interest
3. **Receive** - Process incoming events and stats
4. **Heartbeat** - Automatic ping/pong every 30 seconds
5. **Disconnect** - Connection closes or times out (35s without pong)

## Message Protocol

All messages are JSON objects with a `type` field.

### Client → Server Messages

#### Subscribe

Subscribe to a topic to receive real-time events.

```json
{
  "type": "subscribe",
  "topic": "work|agents|targets|stats",
  "filter": { /* optional filters */ }
}
```

**Topics:**
- `work` - Work submission, assignment, completion events
- `agents` - Agent registration, status, shutdown events
- `targets` - Target configuration, health, spin-up events
- `stats` - Periodic stats updates (every 30s)

**Filters:**

Work filters:
```json
{
  "status": "pending|assigned|in-progress|completed|failed|cancelled",
  "capability": "typescript",
  "boundary": "corporate|personal|open-source",
  "taskId": "specific-task-id",
  "assignedTo": "agent-guid"
}
```

Agent filters:
```json
{
  "agentType": "claude-code|copilot-cli",
  "status": "online|busy|offline",
  "capability": "typescript",
  "boundary": "corporate|personal|open-source",
  "guid": "agent-guid"
}
```

Target filters:
```json
{
  "agentType": "claude-code|copilot-cli",
  "status": "available|in-use|disabled",
  "capability": "typescript",
  "boundary": "corporate|personal|open-source",
  "mechanism": "ssh|kubernetes|local|webhook|github-actions",
  "targetId": "target-id"
}
```

#### Unsubscribe

Unsubscribe from a topic to stop receiving events.

```json
{
  "type": "unsubscribe",
  "topic": "work|agents|targets|stats"
}
```

#### Ping

Send a ping to verify the connection is alive.

```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Acknowledgement

Confirms subscription or unsubscription.

```json
{
  "type": "ack",
  "subscribed": "work",
  "timestamp": "2025-12-23T09:00:00.000Z"
}
```

or

```json
{
  "type": "ack",
  "unsubscribed": "work",
  "timestamp": "2025-12-23T09:00:00.000Z"
}
```

#### Event

Real-time event notification.

```json
{
  "type": "event",
  "topic": "work",
  "event": "work:assigned",
  "data": {
    "workId": "...",
    "taskId": "...",
    "assignedTo": "...",
    "assignedToAgent": {
      "guid": "...",
      "agentType": "claude-code"
    },
    "capability": "typescript",
    "boundary": "personal"
  },
  "timestamp": "2025-12-23T09:00:00.000Z",
  "projectId": "my-project"
}
```

#### Stats Update

Periodic statistics (sent every 30s to subscribed clients).

```json
{
  "type": "stats",
  "data": {
    "agents": {
      "total": 5,
      "byType": {
        "claude-code": 3,
        "copilot-cli": 2
      },
      "byStatus": {
        "online": 3,
        "busy": 2,
        "offline": 0
      }
    },
    "work": {
      "pending": 10,
      "active": 5,
      "completed": 42,
      "failed": 1
    },
    "targets": {
      "total": 8,
      "available": 5,
      "inUse": 2,
      "disabled": 1
    },
    "websocket": {
      "connections": 12,
      "subscriptions": 24
    }
  },
  "timestamp": "2025-12-23T09:00:00.000Z",
  "projectId": "my-project"
}
```

#### Error

Error notification.

```json
{
  "type": "error",
  "error": "Invalid topic",
  "timestamp": "2025-12-23T09:00:00.000Z"
}
```

#### Pong

Response to ping.

```json
{
  "type": "pong",
  "timestamp": "2025-12-23T09:00:00.000Z"
}
```

## Event Types

### Work Events (Topic: `work`)

#### `work:submitted`
New work item submitted to the coordinator.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "capability": "typescript",
  "boundary": "personal",
  "priority": 5,
  "description": "Implement login feature"
}
```

#### `work:assigned`
Work assigned to an agent.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "assignedTo": "agent-guid",
  "assignedToAgent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "capability": "typescript",
  "boundary": "personal"
}
```

#### `work:started`
Agent started working on assigned task.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "assignedTo": "agent-guid",
  "assignedToAgent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  }
}
```

#### `work:progress`
Work progress update.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "assignedTo": "agent-guid",
  "assignedToAgent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "progress": 50
}
```

#### `work:completed`
Work completed successfully.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "assignedTo": "agent-guid",
  "assignedToAgent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "summary": "Login feature implemented"
}
```

#### `work:failed`
Work failed with an error.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "assignedTo": "agent-guid",
  "assignedToAgent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "errorMessage": "Build failed",
  "recoverable": true
}
```

#### `work:cancelled`
Work was cancelled.

**Data:**
```json
{
  "workId": "uuid",
  "taskId": "task-123",
  "assignedTo": "agent-guid",
  "assignedToAgent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  }
}
```

### Agent Events (Topic: `agents`)

#### `agent:registered`
New agent registered with the coordinator.

**Data:**
```json
{
  "agent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "capabilities": ["typescript", "python"],
  "boundaries": ["personal", "open-source"],
  "status": "online"
}
```

#### `agent:updated`
Agent status or task count changed.

**Data:**
```json
{
  "agent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "previousStatus": "online",
  "newStatus": "busy",
  "currentTaskCount": 2
}
```

#### `agent:shutdown`
Agent is shutting down.

**Data:**
```json
{
  "agent": {
    "guid": "agent-guid",
    "agentType": "claude-code"
  },
  "reason": "idle-timeout|manual|coordinator-shutdown|error",
  "graceful": true
}
```

### Target Events (Topic: `targets`)

#### `target:registered`
New spin-up target registered.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "agentType": "claude-code",
  "capabilities": ["typescript", "python"],
  "boundaries": ["personal"],
  "mechanism": "ssh"
}
```

#### `target:updated`
Target configuration or status changed.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "previousStatus": "available",
  "newStatus": "in-use"
}
```

#### `target:disabled`
Target was disabled.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "reason": "Health check failed"
}
```

#### `target:removed`
Target removed from registry.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server"
}
```

#### `target:health-changed`
Target health status changed.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "previousHealth": "healthy",
  "newHealth": "unhealthy",
  "error": "Connection timeout"
}
```

### Spin-Up Events (Topic: `targets`)

#### `spin-up:triggered`
Coordinator determined a spin-up is needed.

**Data:**
```json
{
  "targetAgentType": "claude-code",
  "capability": "typescript",
  "boundary": "personal",
  "workId": "work-uuid"
}
```

#### `spin-up:started`
Target began spin-up process.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "agentType": "claude-code",
  "capability": "typescript",
  "workId": "work-uuid"
}
```

#### `spin-up:completed`
Spin-up completed successfully.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "agentType": "claude-code",
  "agentGuid": "new-agent-guid",
  "durationMs": 5420
}
```

#### `spin-up:failed`
Spin-up attempt failed.

**Data:**
```json
{
  "targetId": "target-123",
  "targetName": "home-server",
  "agentType": "claude-code",
  "errorMessage": "SSH connection failed",
  "workId": "work-uuid"
}
```

## Examples

### Monitor Work Queue

```javascript
// examples/websocket/subscribe-work.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected to Weft');

  // Subscribe to pending work only
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'work',
    filter: { status: 'pending' }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'ack') {
    console.log('Subscribed to:', msg.subscribed);
  }

  if (msg.type === 'event') {
    console.log(`\n[${msg.event}]`);
    console.log(`  Task: ${msg.data.taskId}`);
    console.log(`  Capability: ${msg.data.capability}`);
    console.log(`  Priority: ${msg.data.priority}`);
    console.log(`  Description: ${msg.data.description}`);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from Weft');
});
```

### Monitor Agent Status

```javascript
// examples/websocket/subscribe-agents.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected to Weft');

  // Subscribe to all agent events
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'agents'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'event') {
    const { event, data } = msg;

    switch (event) {
      case 'agent:registered':
        console.log(`✓ Agent registered: ${data.agent.guid} (${data.agent.agentType})`);
        console.log(`  Capabilities: ${data.capabilities.join(', ')}`);
        break;

      case 'agent:updated':
        console.log(`↻ Agent status: ${data.agent.guid}`);
        console.log(`  ${data.previousStatus} → ${data.newStatus}`);
        console.log(`  Tasks: ${data.currentTaskCount}`);
        break;

      case 'agent:shutdown':
        console.log(`✗ Agent shutdown: ${data.agent.guid}`);
        console.log(`  Reason: ${data.reason}`);
        console.log(`  Graceful: ${data.graceful}`);
        break;
    }
  }
});
```

### Dashboard Monitoring

```javascript
// examples/websocket/subscribe-all.mjs
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/api/ws');

const stats = {
  agents: 0,
  work: { pending: 0, active: 0, completed: 0 },
  targets: 0
};

ws.on('open', () => {
  console.log('Connected to Weft - Real-time Dashboard\n');

  // Subscribe to all topics
  ['work', 'agents', 'targets', 'stats'].forEach(topic => {
    ws.send(JSON.stringify({ type: 'subscribe', topic }));
  });
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'stats') {
    // Update dashboard stats
    stats.agents = msg.data.agents.total;
    stats.work = msg.data.work;
    stats.targets = msg.data.targets.total;

    // Clear console and redraw dashboard
    console.clear();
    console.log('=== Weft Dashboard ===\n');
    console.log(`Agents:  ${msg.data.agents.total} total`);
    console.log(`         ${msg.data.agents.byStatus.online || 0} online, ${msg.data.agents.byStatus.busy || 0} busy`);
    console.log();
    console.log(`Work:    ${msg.data.work.pending} pending`);
    console.log(`         ${msg.data.work.active} active`);
    console.log(`         ${msg.data.work.completed} completed`);
    console.log();
    console.log(`Targets: ${msg.data.targets.available}/${msg.data.targets.total} available`);
    console.log();
    console.log(`WebSocket: ${msg.data.websocket.connections} connections`);
    console.log(`Last update: ${new Date(msg.timestamp).toLocaleTimeString()}`);
  }

  if (msg.type === 'event') {
    // Show events as they happen (below stats)
    console.log(`\n[${new Date().toLocaleTimeString()}] ${msg.event}`);
  }
});
```

### Python Client

```python
# examples/websocket/python-client.py
import asyncio
import websockets
import json
from datetime import datetime

async def monitor_weft():
    uri = "ws://localhost:3000/api/ws"

    async with websockets.connect(uri) as ws:
        print("Connected to Weft")

        # Subscribe to work and agent events
        await ws.send(json.dumps({
            "type": "subscribe",
            "topic": "work"
        }))

        await ws.send(json.dumps({
            "type": "subscribe",
            "topic": "agents"
        }))

        # Process messages
        async for message in ws:
            msg = json.loads(message)

            if msg['type'] == 'ack':
                print(f"Subscribed to: {msg.get('subscribed', 'unknown')}")

            elif msg['type'] == 'event':
                timestamp = datetime.fromisoformat(msg['timestamp'].replace('Z', '+00:00'))
                print(f"\n[{timestamp.strftime('%H:%M:%S')}] {msg['event']}")

                # Pretty print event data
                if 'taskId' in msg['data']:
                    print(f"  Task: {msg['data']['taskId']}")
                if 'capability' in msg['data']:
                    print(f"  Capability: {msg['data']['capability']}")
                if 'assignedTo' in msg['data']:
                    print(f"  Agent: {msg['data']['assignedTo']}")

            elif msg['type'] == 'stats':
                print(f"\n=== Stats Update ===")
                print(f"Agents: {msg['data']['agents']['total']}")
                print(f"Work: {msg['data']['work']['pending']} pending, {msg['data']['work']['active']} active")

            elif msg['type'] == 'error':
                print(f"ERROR: {msg['error']}")

if __name__ == "__main__":
    try:
        asyncio.run(monitor_weft())
    except KeyboardInterrupt:
        print("\nDisconnected")
```

## Best Practices

### Subscribe Selectively

Only subscribe to topics and events you need to reduce bandwidth and processing overhead.

```javascript
// Good - specific filter
ws.send(JSON.stringify({
  type: 'subscribe',
  topic: 'work',
  filter: {
    capability: 'typescript',
    status: 'pending'
  }
}));

// Avoid - subscribing to everything unnecessarily
ws.send(JSON.stringify({ type: 'subscribe', topic: 'work' }));
ws.send(JSON.stringify({ type: 'subscribe', topic: 'agents' }));
ws.send(JSON.stringify({ type: 'subscribe', topic: 'targets' }));
```

### Handle Reconnection

Implement exponential backoff for reconnection attempts.

```javascript
function connectWithBackoff(url, maxRetries = 10) {
  let retries = 0;

  function connect() {
    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log('Connected');
      retries = 0; // Reset on successful connection
    });

    ws.on('close', () => {
      if (retries < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(connect, delay);
        retries++;
      }
    });

    return ws;
  }

  return connect();
}
```

### Process Events Asynchronously

Don't block the WebSocket message handler with long-running operations.

```javascript
// Good - async processing
ws.on('message', async (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'event') {
    // Process in background
    processEvent(msg).catch(console.error);
  }
});

async function processEvent(msg) {
  // Long-running operation
  await saveToDatabase(msg);
  await sendNotification(msg);
}
```

### Monitor Connection Health

Use ping/pong to verify the connection is alive.

```javascript
// Send ping every 25 seconds (before server timeout at 30s)
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 25000);

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'pong') {
    console.log('Connection alive');
  }
});
```

### Clean Shutdown

Unsubscribe before closing the connection.

```javascript
process.on('SIGINT', () => {
  console.log('Shutting down...');

  // Unsubscribe from all topics
  ws.send(JSON.stringify({ type: 'unsubscribe', topic: 'work' }));
  ws.send(JSON.stringify({ type: 'unsubscribe', topic: 'agents' }));

  // Close connection
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 100);
});
```

## Performance

### Capacity

- **Connections:** Supports 100+ concurrent clients
- **Throughput:** 50+ events/second per client
- **Latency:** <10ms from event emission to client receipt
- **Memory:** ~1KB per connection

### Heartbeat

- **Ping interval:** 30 seconds
- **Pong timeout:** 35 seconds
- **Auto-disconnect:** Connections that don't respond to ping are terminated

### Stats Updates

- **Interval:** 30 seconds
- **Condition:** Only sent to clients subscribed to `stats` topic
- **Overhead:** Minimal - stats computed once and broadcast to all subscribers

### Filtering

Filters are applied **server-side** to reduce bandwidth. A client subscribed to `work` with `filter: { status: 'pending' }` will only receive `work:submitted` events, not assignment or completion events.

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid message format` | Malformed JSON | Ensure message is valid JSON |
| `Unknown message type` | Invalid `type` field | Use valid message types (subscribe, unsubscribe, ping) |
| `Invalid topic` | Unknown topic name | Use valid topics (work, agents, targets, stats) |
| `Not subscribed to topic` | Unsubscribe without subscription | Only unsubscribe from subscribed topics |

### Error Message Format

```json
{
  "type": "error",
  "error": "Invalid topic: invalid-topic",
  "timestamp": "2025-12-23T09:00:00.000Z"
}
```

### Handling Errors

```javascript
ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'error') {
    console.error('Server error:', msg.error);

    // Handle specific errors
    if (msg.error.includes('Invalid topic')) {
      // Retry with correct topic
    }
  }
});
```

## Monitoring

### Metrics to Track

Track these metrics for WebSocket health:

- `websocket.connections` - Active connection count
- `websocket.subscriptions` - Total subscriptions across all connections
- `websocket.events_sent` - Events broadcast (if implemented)
- `websocket.errors` - Error count

### Health Check

The WebSocket server does not have a dedicated health endpoint. Check the main REST API:

```bash
curl http://localhost:3000/health
```

### Connection Stats

Get connection statistics from the stats topic:

```json
{
  "type": "stats",
  "data": {
    "websocket": {
      "connections": 12,
      "subscriptions": 24
    }
  }
}
```

## Troubleshooting

### Connection Refused

**Problem:** `ECONNREFUSED` error when connecting

**Solution:**
- Verify Weft is running: `curl http://localhost:3000/health`
- Check the WebSocket path is `/api/ws`
- Ensure no firewall blocking port 3000

### Authentication Failed

**Problem:** Connection closes immediately after opening

**Solution:**
- Check if `API_TOKENS` is configured in Weft
- Verify token is passed correctly in URL or header
- Check Weft logs for authentication errors

### No Events Received

**Problem:** Connected and subscribed, but no events received

**Solution:**
- Verify subscription was acknowledged (check for `ack` message)
- Check if any events are actually occurring (trigger a test event)
- Ensure filters aren't too restrictive
- Check if you're subscribed to the correct topic for the event type

### Connection Drops

**Problem:** WebSocket disconnects after 30 seconds

**Solution:**
- Client must respond to ping with pong (handled automatically by most WebSocket libraries)
- Check network stability
- Implement reconnection logic with backoff

## See Also

- [REST API Documentation](./weft/src/api/openapi.yaml)
- [Weft README](./README.md)
- [Caching Guide](./CACHING.md)
- [Example Scripts](./examples/websocket/)

## Changelog

### v0.3.0 (2025-12-23)
- Initial WebSocket API with subscription protocol
- Support for work, agents, targets, and stats topics
- Server-side filtering for all event types
- Automatic heartbeat and stats updates
- 19 coordinator event types
