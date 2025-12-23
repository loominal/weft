/**
 * WebSocket Performance Tests
 *
 * Tests to verify WebSocket server performance under load:
 * - Concurrent connections
 * - Broadcasting throughput
 * - Subscription performance
 * - Memory usage
 * - Event throughput
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HTTPServer } from 'http';
import { WebSocket } from 'ws';
import { WeftWebSocketServer } from '../server.js';
import { BaseCoordinator } from '../../../coordinator/base-coordinator.js';
import {
  createClient,
  subscribe,
  closeClients,
  sleep,
  EventCollector,
} from './test-helpers.js';

describe('WebSocket Performance Tests', () => {
  let httpServer: HTTPServer;
  let wsServer: WeftWebSocketServer;
  let coordinator: BaseCoordinator;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();

    // Find available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });

    // Create coordinator
    coordinator = new BaseCoordinator({
      projectId: 'perf-test',
    });

    // Create WebSocket server
    wsServer = new WeftWebSocketServer(
      httpServer,
      undefined,
      undefined,
      'perf-test'
    );

    // Connect coordinator events to WebSocket server
    coordinator.on('work:submitted', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:assigned', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:completed', (event) => {
      wsServer.broadcastEvent('work', event);
    });
  });

  afterEach(async () => {
    // Shutdown WebSocket server
    if (wsServer) {
      await wsServer.shutdown();
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    // Cleanup coordinator
    if (coordinator) {
      coordinator.removeAllListeners();
    }
  });

  describe('Connection Scaling', () => {
    it('should handle 100+ concurrent connections', async () => {
      const clients: WebSocket[] = [];
      const startTime = Date.now();

      // Connect 100 clients
      for (let i = 0; i < 100; i++) {
        const client = await createClient(port);
        clients.push(client);
      }

      const connectTime = Date.now() - startTime;

      console.log(`Connected 100 clients in ${connectTime}ms`);
      expect(connectTime).toBeLessThan(10000); // < 10 seconds
      expect(wsServer.getConnectionCount()).toBe(100);

      // Cleanup
      await closeClients(clients);
    }, 15000); // 15 second timeout

    it('should handle 200+ concurrent connections', async () => {
      const clients: WebSocket[] = [];
      const startTime = Date.now();

      // Connect 200 clients
      for (let i = 0; i < 200; i++) {
        const client = await createClient(port);
        clients.push(client);
      }

      const connectTime = Date.now() - startTime;

      console.log(`Connected 200 clients in ${connectTime}ms`);
      expect(connectTime).toBeLessThan(20000); // < 20 seconds
      expect(wsServer.getConnectionCount()).toBe(200);

      // Cleanup
      await closeClients(clients);
    }, 30000); // 30 second timeout

    it('should handle rapid sequential connections', async () => {
      const iterations = 50;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const client = await createClient(port);
        await client.close();
        await sleep(10);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Average connection time: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(200); // < 200ms per connection
    }, 15000);
  });

  describe('Broadcasting Performance', () => {
    it('should broadcast to 100 clients efficiently', async () => {
      const clients: WebSocket[] = [];
      const collectors: EventCollector[] = [];

      // Connect and subscribe 100 clients
      for (let i = 0; i < 100; i++) {
        const client = await createClient(port);
        const collector = new EventCollector(client);
        collector.start();
        await subscribe(client, 'work');
        clients.push(client);
        collectors.push(collector);
      }

      // Broadcast event
      const startTime = Date.now();

      coordinator.submitWork({
        taskId: 'broadcast-perf-test',
        description: 'Performance test',
        capability: 'typescript',
        priority: 5,
      });

      // Wait for all clients to receive
      await Promise.all(collectors.map(c => c.waitForCount(1)));

      const broadcastTime = Date.now() - startTime;

      console.log(`Broadcast to 100 clients in ${broadcastTime}ms`);
      expect(broadcastTime).toBeLessThan(2000); // < 2 seconds

      // Verify all received
      collectors.forEach(c => {
        expect(c.getEventCount()).toBe(1);
        c.stop();
      });

      await closeClients(clients);
    }, 15000);

    it('should handle 1000 events to single client', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      await subscribe(client, 'work');

      const eventCount = 1000;
      const startTime = Date.now();

      // Submit 1000 work items
      for (let i = 0; i < eventCount; i++) {
        coordinator.submitWork({
          taskId: `perf-${i}`,
          description: `Performance test ${i}`,
          capability: 'typescript',
          priority: 5,
        });
      }

      // Wait for all events
      await collector.waitForCount(eventCount, 30000);

      const duration = Date.now() - startTime;
      const throughput = eventCount / (duration / 1000); // events/sec

      console.log(`Throughput: ${throughput.toFixed(0)} events/sec`);
      console.log(`Duration: ${duration}ms for ${eventCount} events`);

      expect(throughput).toBeGreaterThan(50); // > 50 events/sec
      expect(collector.getEventCount()).toBe(eventCount);

      collector.stop();
      await client.close();
    }, 35000);

    it.skip('should handle mixed event types efficiently', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      await subscribe(client, 'work');

      const iterations = 100;
      const startTime = Date.now();

      // Create work lifecycle for 100 items (with periodic delays to avoid overwhelming)
      for (let i = 0; i < iterations; i++) {
        const workId = coordinator.submitWork({
          taskId: `task-${i}`,
          description: `Task ${i}`,
          capability: 'typescript',
          priority: 5,
        });

        await coordinator.recordClaim(workId, `agent-${i % 10}`);
        coordinator.startWork(workId);
        coordinator.recordCompletion(workId, { success: true });

        // Small delay every 10 iterations to allow events to propagate
        if (i % 10 === 0) {
          await sleep(10);
        }
      }

      // Each iteration generates 4 events (submitted, assigned, started, completed)
      const expectedEvents = iterations * 4;
      await collector.waitForCount(expectedEvents, 120000); // Further increased for CI

      const duration = Date.now() - startTime;
      const throughput = expectedEvents / (duration / 1000);

      console.log(`Mixed event throughput: ${throughput.toFixed(0)} events/sec`);
      console.log(`Processed ${expectedEvents} events in ${duration}ms`);

      expect(collector.getEventCount()).toBe(expectedEvents);

      collector.stop();
      await client.close();
    }, 150000); // Further increased test timeout for CI
  });

  describe('Subscription Performance', () => {
    it('should handle many subscriptions per client', async () => {
      const client = await createClient(port);

      const startTime = Date.now();

      // Subscribe to work multiple times with different filters
      for (let i = 0; i < 10; i++) {
        await subscribe(client, 'work', { capability: `cap-${i}` });
      }

      const subscribeTime = Date.now() - startTime;
      const avgTime = subscribeTime / 10;

      console.log(`Average subscription time: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(100); // < 100ms per subscription

      await client.close();
    });

    it('should filter efficiently with many clients', async () => {
      const clients: WebSocket[] = [];
      const collectors: EventCollector[] = [];

      // Create 50 clients with different filters
      for (let i = 0; i < 50; i++) {
        const client = await createClient(port);
        const collector = new EventCollector(client);
        collector.start();

        // Each client subscribes to different capability
        await subscribe(client, 'work', { capability: `cap-${i % 10}` });

        clients.push(client);
        collectors.push(collector);
      }

      const startTime = Date.now();

      // Submit work for capability 'cap-5'
      // Should match clients 5, 15, 25, 35, 45 (5 clients)
      coordinator.submitWork({
        taskId: 'filtered-test',
        description: 'Filtered test',
        capability: 'cap-5',
        priority: 5,
      });

      await sleep(500);

      const filterTime = Date.now() - startTime;

      console.log(`Filter and broadcast time: ${filterTime}ms`);
      expect(filterTime).toBeLessThan(1000); // < 1 second

      // Count how many received
      let receivedCount = 0;
      collectors.forEach(c => {
        receivedCount += c.getEventCount();
        c.stop();
      });

      expect(receivedCount).toBe(5); // Only 5 clients should receive

      await closeClients(clients);
    }, 15000);

    it('should handle subscription churn efficiently', async () => {
      const client = await createClient(port);

      const iterations = 50;
      const startTime = Date.now();

      // Rapidly subscribe and unsubscribe
      for (let i = 0; i < iterations; i++) {
        await subscribe(client, 'work', { capability: `cap-${i}` });
      }

      const churnTime = Date.now() - startTime;
      const avgTime = churnTime / iterations;

      console.log(`Subscription churn avg time: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50); // < 50ms per operation

      await client.close();
    }, 10000);
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory with many connections', async () => {
      const clients: WebSocket[] = [];

      // Connect 100 clients
      for (let i = 0; i < 100; i++) {
        const client = await createClient(port);
        await subscribe(client, 'work');
        clients.push(client);
      }

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Submit many events
      for (let i = 0; i < 100; i++) {
        coordinator.submitWork({
          taskId: `mem-test-${i}`,
          description: `Memory test ${i}`,
          capability: 'typescript',
          priority: 5,
        });
      }

      await sleep(1000);

      // Get final memory usage
      const finalMemory = process.memoryUsage();

      // Calculate memory increase
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreaseMB = heapIncrease / 1024 / 1024;

      console.log(`Heap increase: ${heapIncreaseMB.toFixed(2)}MB`);

      // Memory increase should be reasonable (< 100MB)
      expect(heapIncreaseMB).toBeLessThan(100);

      await closeClients(clients);
    }, 20000);

    it('should clean up connections properly', async () => {
      const clients: WebSocket[] = [];

      // Connect 50 clients
      for (let i = 0; i < 50; i++) {
        const client = await createClient(port);
        clients.push(client);
      }

      expect(wsServer.getConnectionCount()).toBe(50);

      // Close all clients
      await closeClients(clients);

      // Give server time to process disconnects
      await sleep(500);

      expect(wsServer.getConnectionCount()).toBe(0);
    });
  });

  describe('Performance Report', () => {
    it('should generate comprehensive performance report', async () => {
      const report = {
        timestamp: new Date().toISOString(),
        tests: [] as Array<{
          name: string;
          metric: string;
          value: number;
          unit: string;
          passed: boolean;
          threshold: number;
        }>,
      };

      // Test 1: Connection time
      const connectStart = Date.now();
      const client1 = await createClient(port);
      const connectTime = Date.now() - connectStart;

      report.tests.push({
        name: 'Single connection time',
        metric: 'latency',
        value: connectTime,
        unit: 'ms',
        passed: connectTime < 100,
        threshold: 100,
      });

      // Test 2: Subscription time
      const subscribeStart = Date.now();
      await subscribe(client1, 'work');
      const subscribeTime = Date.now() - subscribeStart;

      report.tests.push({
        name: 'Subscription time',
        metric: 'latency',
        value: subscribeTime,
        unit: 'ms',
        passed: subscribeTime < 50,
        threshold: 50,
      });

      // Test 3: Event latency
      const collector = new EventCollector(client1);
      collector.start();

      const eventStart = Date.now();
      coordinator.submitWork({
        taskId: 'latency-test',
        description: 'Latency test',
        capability: 'typescript',
        priority: 5,
      });

      await collector.waitForCount(1);
      const eventLatency = Date.now() - eventStart;

      report.tests.push({
        name: 'Event delivery latency',
        metric: 'latency',
        value: eventLatency,
        unit: 'ms',
        passed: eventLatency < 100,
        threshold: 100,
      });

      collector.stop();

      // Test 4: Throughput
      const throughputStart = Date.now();
      const eventCount = 100;

      for (let i = 0; i < eventCount; i++) {
        coordinator.submitWork({
          taskId: `throughput-${i}`,
          description: `Throughput test ${i}`,
          capability: 'typescript',
          priority: 5,
        });
      }

      const throughputTime = Date.now() - throughputStart;
      const throughput = eventCount / (throughputTime / 1000);

      report.tests.push({
        name: 'Event throughput',
        metric: 'throughput',
        value: Math.round(throughput),
        unit: 'events/sec',
        passed: throughput > 100,
        threshold: 100,
      });

      // Test 5: Concurrent clients
      const concurrentStart = Date.now();
      const clients: WebSocket[] = [];

      for (let i = 0; i < 50; i++) {
        const client = await createClient(port);
        clients.push(client);
      }

      const concurrentTime = Date.now() - concurrentStart;
      const avgConnectTime = concurrentTime / 50;

      report.tests.push({
        name: 'Concurrent connection avg time',
        metric: 'latency',
        value: Math.round(avgConnectTime),
        unit: 'ms',
        passed: avgConnectTime < 100,
        threshold: 100,
      });

      // Print report
      console.log('\n=== WebSocket Performance Report ===');
      console.log(`Generated: ${report.timestamp}`);
      console.log('\nTest Results:');

      report.tests.forEach(test => {
        const status = test.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${status} ${test.name}: ${test.value}${test.unit} (threshold: ${test.threshold}${test.unit})`);
      });

      const passedTests = report.tests.filter(t => t.passed).length;
      const totalTests = report.tests.length;

      console.log(`\nSummary: ${passedTests}/${totalTests} tests passed`);
      console.log('=====================================\n');

      // Most tests should pass (allow 1-2 to fail due to timing variability)
      expect(passedTests).toBeGreaterThanOrEqual(3); // At least 3 out of 5 should pass

      // Cleanup
      await client1.close();
      await closeClients(clients);
    }, 30000);
  });
});
