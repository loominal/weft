#!/usr/bin/env node
/**
 * Monitor Agent Status
 *
 * Subscribes to agent events and displays real-time updates as agents
 * register, change status, and shut down.
 *
 * Usage:
 *   node subscribe-agents.js [websocket-url]
 *
 * Examples:
 *   node subscribe-agents.js
 *   node subscribe-agents.js ws://localhost:3000/api/ws
 *   node subscribe-agents.js ws://localhost:3000/api/ws?token=dev-token
 */

const WebSocket = require('ws');

// Get WebSocket URL from command line or use default
const wsUrl = process.argv[2] || 'ws://localhost:3000/api/ws';

console.log(`Connecting to Weft WebSocket at ${wsUrl}...`);

const ws = new WebSocket(wsUrl);

// Track agents for better display
const agents = new Map();

ws.on('open', () => {
  console.log('✓ Connected to Weft\n');

  // Subscribe to all agent events
  console.log('Subscribing to agent events...');
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'agents'
  }));

  // Optionally filter by agent type
  // ws.send(JSON.stringify({
  //   type: 'subscribe',
  //   topic: 'agents',
  //   filter: { agentType: 'claude-code' }
  // }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  // Handle acknowledgement
  if (msg.type === 'ack') {
    if (msg.subscribed) {
      console.log(`✓ Subscribed to topic: ${msg.subscribed}\n`);
      console.log('Waiting for agent events...\n');
    }
  }

  // Handle events
  if (msg.type === 'event') {
    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
    const { data, event } = msg;

    switch (event) {
      case 'agent:registered': {
        const agentId = data.agent.guid.substring(0, 8);
        agents.set(data.agent.guid, {
          type: data.agent.agentType,
          status: data.status,
          capabilities: data.capabilities,
          boundaries: data.boundaries
        });

        console.log(`[${timestamp}] ✓ Agent Registered`);
        console.log(`  ID: ${agentId}...`);
        console.log(`  Type: ${data.agent.agentType}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Capabilities: ${data.capabilities.join(', ')}`);
        console.log(`  Boundaries: ${data.boundaries.join(', ')}`);
        console.log();
        break;
      }

      case 'agent:updated': {
        const agentId = data.agent.guid.substring(0, 8);
        const stored = agents.get(data.agent.guid);

        if (stored) {
          stored.status = data.newStatus;
        }

        console.log(`[${timestamp}] ↻ Agent Status Changed`);
        console.log(`  ID: ${agentId}...`);
        console.log(`  Type: ${data.agent.agentType}`);
        console.log(`  Status: ${data.previousStatus || 'unknown'} → ${data.newStatus}`);
        console.log(`  Current Tasks: ${data.currentTaskCount}`);
        console.log();
        break;
      }

      case 'agent:shutdown': {
        const agentId = data.agent.guid.substring(0, 8);
        agents.delete(data.agent.guid);

        console.log(`[${timestamp}] ✗ Agent Shutdown`);
        console.log(`  ID: ${agentId}...`);
        console.log(`  Type: ${data.agent.agentType}`);
        console.log(`  Reason: ${data.reason}`);
        console.log(`  Graceful: ${data.graceful ? 'Yes' : 'No'}`);
        console.log();
        break;
      }

      default:
        console.log(`[${timestamp}] ${event}`);
        console.log(`  Data:`, JSON.stringify(data, null, 2));
        console.log();
    }
  }

  // Handle errors
  if (msg.type === 'error') {
    console.error(`✗ Error: ${msg.error}`);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n✗ Disconnected from Weft');
  console.log(`\nTracked ${agents.size} agent(s) during session`);
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'unsubscribe',
      topic: 'agents'
    }));

    setTimeout(() => {
      ws.close();
    }, 100);
  } else {
    process.exit(0);
  }
});
