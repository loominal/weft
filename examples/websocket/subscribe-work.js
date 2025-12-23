#!/usr/bin/env node
/**
 * Monitor Work Queue
 *
 * Subscribes to work events and displays real-time updates as work items
 * are submitted, assigned, and completed.
 *
 * Usage:
 *   node subscribe-work.js [websocket-url]
 *
 * Examples:
 *   node subscribe-work.js
 *   node subscribe-work.js ws://localhost:3000/api/ws
 *   node subscribe-work.js ws://localhost:3000/api/ws?token=dev-token
 */

const WebSocket = require('ws');

// Get WebSocket URL from command line or use default
const wsUrl = process.argv[2] || 'ws://localhost:3000/api/ws';

console.log(`Connecting to Weft WebSocket at ${wsUrl}...`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ Connected to Weft\n');

  // Subscribe to all work events
  console.log('Subscribing to work events...');
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'work'
  }));

  // Optionally subscribe with a filter for pending work only
  // ws.send(JSON.stringify({
  //   type: 'subscribe',
  //   topic: 'work',
  //   filter: { status: 'pending' }
  // }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  // Handle acknowledgement
  if (msg.type === 'ack') {
    if (msg.subscribed) {
      console.log(`✓ Subscribed to topic: ${msg.subscribed}\n`);
      console.log('Waiting for work events...\n');
    }
    if (msg.unsubscribed) {
      console.log(`✓ Unsubscribed from topic: ${msg.unsubscribed}`);
    }
  }

  // Handle events
  if (msg.type === 'event') {
    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
    console.log(`[${timestamp}] ${msg.event}`);

    const { data } = msg;

    switch (msg.event) {
      case 'work:submitted':
        console.log(`  Task ID: ${data.taskId}`);
        console.log(`  Capability: ${data.capability}`);
        console.log(`  Boundary: ${data.boundary}`);
        console.log(`  Priority: ${data.priority}`);
        console.log(`  Description: ${data.description}`);
        break;

      case 'work:assigned':
        console.log(`  Task ID: ${data.taskId}`);
        console.log(`  Assigned to: ${data.assignedToAgent?.agentType || data.assignedTo}`);
        console.log(`  Capability: ${data.capability}`);
        break;

      case 'work:started':
        console.log(`  Task ID: ${data.taskId}`);
        console.log(`  Agent: ${data.assignedToAgent?.agentType || data.assignedTo}`);
        break;

      case 'work:progress':
        console.log(`  Task ID: ${data.taskId}`);
        console.log(`  Progress: ${data.progress}%`);
        break;

      case 'work:completed':
        console.log(`  Task ID: ${data.taskId}`);
        if (data.summary) {
          console.log(`  Summary: ${data.summary}`);
        }
        break;

      case 'work:failed':
        console.log(`  Task ID: ${data.taskId}`);
        console.log(`  Error: ${data.errorMessage}`);
        console.log(`  Recoverable: ${data.recoverable}`);
        break;

      case 'work:cancelled':
        console.log(`  Task ID: ${data.taskId}`);
        break;

      default:
        console.log(`  Data:`, JSON.stringify(data, null, 2));
    }

    console.log(); // Blank line between events
  }

  // Handle stats updates
  if (msg.type === 'stats') {
    // Stats are not subscribed by default in this example
    // Uncomment the subscription above if you want stats
  }

  // Handle errors
  if (msg.type === 'error') {
    console.error(`✗ Error: ${msg.error}`);
  }

  // Handle pong
  if (msg.type === 'pong') {
    // Silent - connection health check
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n✗ Disconnected from Weft');
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');

  // Unsubscribe before closing
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'unsubscribe',
      topic: 'work'
    }));

    setTimeout(() => {
      ws.close();
    }, 100);
  } else {
    process.exit(0);
  }
});
