#!/usr/bin/env node
/**
 * WebSocket Server Manual Test Script
 *
 * Tests the WebSocket server functionality:
 * 1. Starts NATS and Weft via Docker Compose
 * 2. Connects WebSocket client
 * 3. Verifies health endpoint includes WebSocket stats
 * 4. Tests ping/pong messages
 */

import WebSocket from 'ws';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/api/ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHealthEndpoint() {
  console.log('\n1. Testing health endpoint...');
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();

  console.log('Health response:', JSON.stringify(data, null, 2));

  if (!data.websocket) {
    throw new Error('Health endpoint missing websocket stats');
  }

  if (typeof data.websocket.connections !== 'number') {
    throw new Error('WebSocket stats missing connection count');
  }

  console.log('✓ Health endpoint includes WebSocket stats');
}

async function testWebSocketConnection() {
  console.log('\n2. Testing WebSocket connection...');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        reject(new Error('Connection timeout'));
      }
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      connected = true;
      console.log('✓ WebSocket connection established');

      // Test ping/pong
      console.log('\n3. Testing ping/pong messages...');

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('Received message:', message);

        if (message.type === 'pong') {
          console.log('✓ Ping/pong working');
          ws.close();
          resolve();
        }
      });

      // Send ping
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      if (!connected) {
        clearTimeout(timeout);
        reject(new Error('Connection closed before established'));
      }
    });
  });
}

async function testConnectionCount() {
  console.log('\n4. Testing connection count tracking...');

  // Connect two clients
  const ws1 = new WebSocket(WS_URL);
  const ws2 = new WebSocket(WS_URL);

  await Promise.all([
    new Promise((resolve) => ws1.on('open', resolve)),
    new Promise((resolve) => ws2.on('open', resolve)),
  ]);

  console.log('Two clients connected');

  // Wait a moment for server to process
  await sleep(100);

  // Check health endpoint
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();

  if (data.websocket.connections !== 2) {
    throw new Error(`Expected 2 connections, got ${data.websocket.connections}`);
  }

  console.log('✓ Connection count tracking correct');

  // Close clients
  ws1.close();
  ws2.close();

  await sleep(100);

  // Verify count decreased
  const response2 = await fetch(`${API_URL}/health`);
  const data2 = await response2.json();

  if (data2.websocket.connections !== 0) {
    throw new Error(`Expected 0 connections, got ${data2.websocket.connections}`);
  }

  console.log('✓ Connection count updates on disconnect');
}

async function main() {
  console.log('WebSocket Server Manual Test\n');
  console.log('Prerequisites:');
  console.log('1. NATS running on localhost:4222');
  console.log('2. Weft running on localhost:3000\n');
  console.log('Run: docker-compose up -d\n');

  try {
    await testHealthEndpoint();
    await testWebSocketConnection();
    await testConnectionCount();

    console.log('\n✓ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  }
}

main();
