#!/usr/bin/env node
/**
 * Real-time Dashboard
 *
 * Subscribes to all topics (work, agents, targets, stats) and displays
 * a live dashboard with system statistics and recent events.
 *
 * Usage:
 *   node subscribe-all.mjs [websocket-url]
 *
 * Examples:
 *   node subscribe-all.mjs
 *   node subscribe-all.mjs ws://localhost:3000/api/ws
 *   node subscribe-all.mjs ws://localhost:3000/api/ws?token=dev-token
 */

import WebSocket from 'ws';

// Get WebSocket URL from command line or use default
const wsUrl = process.argv[2] || 'ws://localhost:3000/api/ws';

console.log(`Connecting to Weft WebSocket at ${wsUrl}...`);

const ws = new WebSocket(wsUrl);

// Dashboard state
const dashboard = {
  agents: { total: 0, online: 0, busy: 0, offline: 0 },
  work: { pending: 0, active: 0, completed: 0, failed: 0 },
  targets: { total: 0, available: 0, inUse: 0, disabled: 0 },
  websocket: { connections: 0, subscriptions: 0 },
  lastUpdate: null,
  recentEvents: []
};

// Store recent events (last 10)
function addEvent(event, summary) {
  const timestamp = new Date().toLocaleTimeString();
  dashboard.recentEvents.unshift({ timestamp, event, summary });
  if (dashboard.recentEvents.length > 10) {
    dashboard.recentEvents.pop();
  }
}

// Render dashboard to console
function renderDashboard() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    Weft Real-Time Dashboard                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();

  // Agents section
  console.log('📊 AGENTS');
  console.log(`   Total: ${dashboard.agents.total}`);
  console.log(`   Online: ${dashboard.agents.online}  Busy: ${dashboard.agents.busy}  Offline: ${dashboard.agents.offline}`);
  console.log();

  // Work section
  console.log('📋 WORK');
  console.log(`   Pending: ${dashboard.work.pending}  Active: ${dashboard.work.active}`);
  console.log(`   Completed: ${dashboard.work.completed}  Failed: ${dashboard.work.failed}`);
  console.log();

  // Targets section
  console.log('🎯 TARGETS');
  console.log(`   Total: ${dashboard.targets.total}`);
  console.log(`   Available: ${dashboard.targets.available}  In-Use: ${dashboard.targets.inUse}  Disabled: ${dashboard.targets.disabled}`);
  console.log();

  // WebSocket stats
  console.log('🔌 WEBSOCKET');
  console.log(`   Connections: ${dashboard.websocket.connections}  Subscriptions: ${dashboard.websocket.subscriptions}`);
  console.log();

  // Recent events
  if (dashboard.recentEvents.length > 0) {
    console.log('📡 RECENT EVENTS');
    dashboard.recentEvents.forEach(({ timestamp, event, summary }) => {
      console.log(`   [${timestamp}] ${event}`);
      if (summary) {
        console.log(`      ${summary}`);
      }
    });
    console.log();
  }

  // Last update
  if (dashboard.lastUpdate) {
    console.log(`Last update: ${dashboard.lastUpdate}`);
  }

  console.log();
  console.log('Press Ctrl+C to exit');
}

ws.on('open', () => {
  console.log('✓ Connected to Weft\n');
  console.log('Subscribing to all topics...\n');

  // Subscribe to all topics
  const topics = ['work', 'agents', 'targets', 'stats'];
  topics.forEach(topic => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      topic
    }));
  });
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  // Handle stats updates
  if (msg.type === 'stats') {
    // Update dashboard state
    dashboard.agents.total = msg.data.agents.total;
    dashboard.agents.online = msg.data.agents.byStatus.online || 0;
    dashboard.agents.busy = msg.data.agents.byStatus.busy || 0;
    dashboard.agents.offline = msg.data.agents.byStatus.offline || 0;

    dashboard.work.pending = msg.data.work.pending;
    dashboard.work.active = msg.data.work.active;
    dashboard.work.completed = msg.data.work.completed;
    dashboard.work.failed = msg.data.work.failed;

    dashboard.targets.total = msg.data.targets.total;
    dashboard.targets.available = msg.data.targets.available;
    dashboard.targets.inUse = msg.data.targets.inUse;
    dashboard.targets.disabled = msg.data.targets.disabled;

    if (msg.data.websocket) {
      dashboard.websocket.connections = msg.data.websocket.connections;
      dashboard.websocket.subscriptions = msg.data.websocket.subscriptions;
    }

    dashboard.lastUpdate = new Date(msg.timestamp).toLocaleTimeString();

    // Render updated dashboard
    renderDashboard();
  }

  // Handle events
  if (msg.type === 'event') {
    let summary = '';
    const { data, event } = msg;

    switch (event) {
      case 'work:submitted':
        summary = `Task: ${data.taskId} (${data.capability})`;
        break;
      case 'work:assigned':
        summary = `Task: ${data.taskId} → ${data.assignedToAgent?.agentType || 'agent'}`;
        break;
      case 'work:completed':
        summary = `Task: ${data.taskId}`;
        break;
      case 'work:failed':
        summary = `Task: ${data.taskId} - ${data.errorMessage}`;
        break;
      case 'agent:registered':
        summary = `${data.agent.agentType} (${data.capabilities.join(', ')})`;
        break;
      case 'agent:updated':
        summary = `${data.agent.agentType}: ${data.previousStatus} → ${data.newStatus}`;
        break;
      case 'agent:shutdown':
        summary = `${data.agent.agentType} (${data.reason})`;
        break;
      case 'target:registered':
        summary = `${data.targetName} (${data.mechanism})`;
        break;
      case 'spin-up:started':
        summary = `${data.targetName} → ${data.agentType}`;
        break;
      case 'spin-up:completed':
        summary = `${data.targetName} (${data.durationMs}ms)`;
        break;
      case 'spin-up:failed':
        summary = `${data.targetName}: ${data.errorMessage}`;
        break;
      default:
        summary = JSON.stringify(data).substring(0, 50);
    }

    addEvent(event, summary);
    renderDashboard();
  }

  // Handle acknowledgements
  if (msg.type === 'ack' && msg.subscribed) {
    // Don't render dashboard yet, wait for first stats update
  }

  // Handle errors
  if (msg.type === 'error') {
    addEvent('ERROR', msg.error);
    renderDashboard();
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

  if (ws.readyState === WebSocket.OPEN) {
    // Unsubscribe from all topics
    ['work', 'agents', 'targets', 'stats'].forEach(topic => {
      ws.send(JSON.stringify({
        type: 'unsubscribe',
        topic
      }));
    });

    setTimeout(() => {
      ws.close();
    }, 200);
  } else {
    process.exit(0);
  }
});
