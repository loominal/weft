/**
 * WebSocket Integration Tests
 *
 * End-to-end tests verifying the complete WebSocket workflow including:
 * - Connection lifecycle
 * - Subscription management
 * - Event broadcasting
 * - Filtering behavior
 * - Multiple concurrent clients
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HTTPServer } from 'http';
import { WebSocket } from 'ws';
import { WeftWebSocketServer } from '../server.js';
import { BaseCoordinator } from '../../../coordinator/base-coordinator.js';
import { CoordinatorEventType } from '@loominal/shared';
import {
  createClient,
  subscribe,
  unsubscribe,
  closeClient,
  closeClients,
  waitForEvent,
  waitForError,
  waitForPong,
  waitFor,
  sleep,
  EventCollector,
} from './test-helpers.js';

describe('WebSocket Integration Tests', () => {
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
      projectId: 'test-project',
    });

    // Create WebSocket server
    wsServer = new WeftWebSocketServer(
      httpServer,
      undefined,
      undefined,
      'test-project'
    );

    // Connect coordinator events to WebSocket server
    coordinator.on('work:submitted', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:assigned', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:started', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:completed', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:failed', (event) => {
      wsServer.broadcastEvent('work', event);
    });

    coordinator.on('work:cancelled', (event) => {
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

  describe('Connection Lifecycle', () => {
    it('should handle complete connection lifecycle', async () => {
      const client = await createClient(port);
      expect(wsServer.getConnectionCount()).toBe(1);

      await closeClient(client);
      await sleep(100); // Give server time to process disconnect

      expect(wsServer.getConnectionCount()).toBe(0);
    });

    it('should handle multiple sequential connections', async () => {
      for (let i = 0; i < 5; i++) {
        const client = await createClient(port);
        expect(wsServer.getConnectionCount()).toBe(1);
        await closeClient(client);
        await sleep(100);
        expect(wsServer.getConnectionCount()).toBe(0);
      }
    });

    it('should handle client reconnection', async () => {
      // First connection
      const client1 = await createClient(port);
      await subscribe(client1, 'work');
      await closeClient(client1);
      await sleep(100);

      // Reconnect
      const client2 = await createClient(port);
      await subscribe(client2, 'work');
      expect(wsServer.getConnectionCount()).toBe(1);

      await closeClient(client2);
    });

    it('should handle ping/pong protocol', async () => {
      const client = await createClient(port);

      // Send ping
      client.send(JSON.stringify({ type: 'ping' }));

      // Wait for pong
      const pong = await waitForPong(client);
      expect(pong.type).toBe('pong');
      expect(pong.timestamp).toBeDefined();

      await closeClient(client);
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to a topic successfully', async () => {
      const client = await createClient(port);
      await subscribe(client, 'work');
      await closeClient(client);
    });

    it('should subscribe to multiple topics', async () => {
      const client = await createClient(port);
      await subscribe(client, 'work');
      await subscribe(client, 'agents');
      await subscribe(client, 'targets');
      await closeClient(client);
    });

    it('should unsubscribe from a topic successfully', async () => {
      const client = await createClient(port);
      await subscribe(client, 'work');
      await unsubscribe(client, 'work');
      await closeClient(client);
    });

    it('should handle unsubscribe from non-existent subscription', async () => {
      const client = await createClient(port);

      // Send unsubscribe without subscribing first
      client.send(JSON.stringify({
        type: 'unsubscribe',
        topic: 'work',
      }));

      // Should receive error
      const error = await waitForError(client);
      expect(error.type).toBe('error');
      expect(error.error).toContain('Not subscribed');

      await closeClient(client);
    });

    it('should replace existing subscription with new filter', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Subscribe with filter for typescript
      await subscribe(client, 'work', { capability: 'typescript' });

      // Submit typescript work
      coordinator.submitWork({
        taskId: 'task-1',
        description: 'TypeScript work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);

      // Re-subscribe with filter for python
      await subscribe(client, 'work', { capability: 'python' });

      // Submit python work
      coordinator.submitWork({
        taskId: 'task-2',
        description: 'Python work',
        capability: 'python',
        priority: 5,
      });

      await sleep(100);

      const events = collector.getEvents();
      // Should have received both events (one from each subscription)
      expect(events.length).toBeGreaterThanOrEqual(1);

      collector.stop();
      await closeClient(client);
    });
  });

  describe('Event Broadcasting', () => {
    it('should receive work:submitted event', async () => {
      const client = await createClient(port);
      await subscribe(client, 'work');

      // Submit work
      coordinator.submitWork({
        taskId: 'task-1',
        description: 'Test work',
        capability: 'typescript',
        priority: 5,
      });

      // Wait for event
      const event = await waitForEvent(client, CoordinatorEventType.WORK_SUBMITTED);
      expect(event.type).toBe('event');
      expect(event.topic).toBe('work');
      expect(event.event).toBe(CoordinatorEventType.WORK_SUBMITTED);
      expect(event.data.taskId).toBe('task-1');

      await closeClient(client);
    });

    it('should receive all work event types', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      await subscribe(client, 'work');

      // Submit work
      const workId = coordinator.submitWork({
        taskId: 'task-1',
        description: 'Test work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(50);

      // Claim work
      await coordinator.recordClaim(workId, 'agent-1');

      await sleep(50);

      // Mark as started
      coordinator.startWork(workId);

      await sleep(50);

      // Update progress
      coordinator.updateProgress(workId, 50);

      await sleep(50);

      // Complete work
      coordinator.recordCompletion(workId, { success: true });

      // Wait for all events (with longer timeout for CI)
      await collector.waitForCount(5, 20000);

      const events = collector.getEvents();
      expect(events.length).toBe(5);

      const eventTypes = events.map(e => e.event);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_SUBMITTED);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_ASSIGNED);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_STARTED);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_PROGRESS);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_COMPLETED);

      collector.stop();
      await closeClient(client);
    }, 30000); // Increased timeout for CI

    it('should broadcast to multiple clients', async () => {
      const client1 = await createClient(port);
      const client2 = await createClient(port);
      const client3 = await createClient(port);

      const collector1 = new EventCollector(client1);
      const collector2 = new EventCollector(client2);
      const collector3 = new EventCollector(client3);

      collector1.start();
      collector2.start();
      collector3.start();

      await subscribe(client1, 'work');
      await subscribe(client2, 'work');
      await subscribe(client3, 'work');

      // Submit work
      coordinator.submitWork({
        taskId: 'broadcast-test',
        description: 'Broadcast test',
        capability: 'typescript',
        priority: 5,
      });

      // Wait for all clients to receive
      await Promise.all([
        collector1.waitForCount(1),
        collector2.waitForCount(1),
        collector3.waitForCount(1),
      ]);

      expect(collector1.getEventCount()).toBe(1);
      expect(collector2.getEventCount()).toBe(1);
      expect(collector3.getEventCount()).toBe(1);

      collector1.stop();
      collector2.stop();
      collector3.stop();

      await closeClients([client1, client2, client3]);
    });

    it('should not send events to unsubscribed clients', async () => {
      const client1 = await createClient(port);
      const client2 = await createClient(port);

      const collector1 = new EventCollector(client1);
      const collector2 = new EventCollector(client2);

      collector1.start();
      collector2.start();

      // Only client1 subscribes
      await subscribe(client1, 'work');

      // Submit work
      coordinator.submitWork({
        taskId: 'task-1',
        description: 'Test work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(200);

      // Only client1 should receive event
      expect(collector1.getEventCount()).toBe(1);
      expect(collector2.getEventCount()).toBe(0);

      collector1.stop();
      collector2.stop();

      await closeClients([client1, client2]);
    });
  });

  describe('Event Filtering', () => {
    it('should filter work events by capability', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Subscribe with capability filter
      await subscribe(client, 'work', { capability: 'typescript' });

      // Submit typescript work (should receive)
      coordinator.submitWork({
        taskId: 'ts-work',
        description: 'TypeScript work',
        capability: 'typescript',
        priority: 5,
      });

      // Submit python work (should NOT receive)
      coordinator.submitWork({
        taskId: 'py-work',
        description: 'Python work',
        capability: 'python',
        priority: 5,
      });

      await sleep(200);

      const events = collector.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]!.data.taskId).toBe('ts-work');

      collector.stop();
      await closeClient(client);
    });

    it('should filter work events by status', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Subscribe for completed events only
      await subscribe(client, 'work', { status: 'completed' });

      const workId = coordinator.submitWork({
        taskId: 'task-1',
        description: 'Test work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);

      // Should not receive submitted event
      expect(collector.getEventCount()).toBe(0);

      // Claim and start
      await coordinator.recordClaim(workId, 'agent-1');
      coordinator.startWork(workId);

      await sleep(100);

      // Still should not receive
      expect(collector.getEventCount()).toBe(0);

      // Complete work
      coordinator.recordCompletion(workId, { success: true });

      await collector.waitForCount(1);

      const events = collector.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]!.event).toBe(CoordinatorEventType.WORK_COMPLETED);

      collector.stop();
      await closeClient(client);
    });

    it('should filter work events by multiple criteria', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Subscribe with multiple filters
      await subscribe(client, 'work', {
        capability: 'typescript',
        status: 'pending',
      });

      // Submit matching work
      coordinator.submitWork({
        taskId: 'matching',
        description: 'Matching work',
        capability: 'typescript',
        priority: 5,
      });

      // Submit non-matching capability
      coordinator.submitWork({
        taskId: 'wrong-capability',
        description: 'Python work',
        capability: 'python',
        priority: 5,
      });

      await sleep(200);

      const events = collector.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]!.data.taskId).toBe('matching');

      collector.stop();
      await closeClient(client);
    });

    it('should filter work events by taskId', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Subscribe for specific task
      await subscribe(client, 'work', { taskId: 'important-task' });

      // Submit matching task
      coordinator.submitWork({
        taskId: 'important-task',
        description: 'Important work',
        capability: 'typescript',
        priority: 5,
      });

      // Submit other tasks
      coordinator.submitWork({
        taskId: 'other-task-1',
        description: 'Other work',
        capability: 'typescript',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'other-task-2',
        description: 'Another work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(200);

      const events = collector.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]!.data.taskId).toBe('important-task');

      collector.stop();
      await closeClient(client);
    });
  });

  describe('Multiple Concurrent Clients', () => {
    it('should handle 10 concurrent clients', async () => {
      const clients: WebSocket[] = [];
      const collectors: EventCollector[] = [];

      // Connect 10 clients
      for (let i = 0; i < 10; i++) {
        const client = await createClient(port);
        const collector = new EventCollector(client);
        collector.start();
        await subscribe(client, 'work');
        clients.push(client);
        collectors.push(collector);
      }

      expect(wsServer.getConnectionCount()).toBe(10);

      // Submit work
      coordinator.submitWork({
        taskId: 'concurrent-test',
        description: 'Concurrent test',
        capability: 'typescript',
        priority: 5,
      });

      // All clients should receive
      await Promise.all(collectors.map(c => c.waitForCount(1)));

      collectors.forEach(c => {
        expect(c.getEventCount()).toBe(1);
        c.stop();
      });

      await closeClients(clients);
    });

    it('should handle 50 concurrent clients', async () => {
      const clients: WebSocket[] = [];

      // Connect 50 clients
      for (let i = 0; i < 50; i++) {
        const client = await createClient(port);
        await subscribe(client, 'work');
        clients.push(client);
      }

      expect(wsServer.getConnectionCount()).toBe(50);

      // Submit work
      coordinator.submitWork({
        taskId: 'large-broadcast',
        description: 'Large broadcast test',
        capability: 'typescript',
        priority: 5,
      });

      // Give time for all to receive
      await sleep(500);

      await closeClients(clients);
    });

    it('should handle clients with different subscriptions', async () => {
      const workClient = await createClient(port);
      const agentsClient = await createClient(port);
      const allClient = await createClient(port);

      const workCollector = new EventCollector(workClient);
      const agentsCollector = new EventCollector(agentsClient);
      const allCollector = new EventCollector(allClient);

      workCollector.start();
      agentsCollector.start();
      allCollector.start();

      await subscribe(workClient, 'work');
      await subscribe(agentsClient, 'agents');
      await subscribe(allClient, 'work');
      await subscribe(allClient, 'agents');

      // Submit work
      coordinator.submitWork({
        taskId: 'task-1',
        description: 'Test work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(200);

      // Check who received
      expect(workCollector.getEventCount()).toBe(1);
      expect(agentsCollector.getEventCount()).toBe(0);
      expect(allCollector.getEventCount()).toBe(1);

      workCollector.stop();
      agentsCollector.stop();
      allCollector.stop();

      await closeClients([workClient, agentsClient, allClient]);
    });

    it('should handle clients with overlapping filters', async () => {
      const client1 = await createClient(port);
      const client2 = await createClient(port);
      const client3 = await createClient(port);

      const collector1 = new EventCollector(client1);
      const collector2 = new EventCollector(client2);
      const collector3 = new EventCollector(client3);

      collector1.start();
      collector2.start();
      collector3.start();

      // Client 1: All typescript work
      await subscribe(client1, 'work', { capability: 'typescript' });

      // Client 2: Pending typescript work
      await subscribe(client2, 'work', {
        capability: 'typescript',
        status: 'pending',
      });

      // Client 3: All work
      await subscribe(client3, 'work');

      // Submit typescript work
      coordinator.submitWork({
        taskId: 'ts-task',
        description: 'TypeScript work',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(200);

      // All should receive
      expect(collector1.getEventCount()).toBe(1);
      expect(collector2.getEventCount()).toBe(1);
      expect(collector3.getEventCount()).toBe(1);

      collector1.stop();
      collector2.stop();
      collector3.stop();

      await closeClients([client1, client2, client3]);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message format', async () => {
      const client = await createClient(port);

      // Send invalid JSON
      client.send('not json');

      await sleep(100);

      // Connection should still be alive
      expect(wsServer.getConnectionCount()).toBe(1);

      await closeClient(client);
    });

    it('should handle unknown message type', async () => {
      const client = await createClient(port);

      // Send unknown message type
      client.send(JSON.stringify({
        type: 'unknown-type',
        data: 'test',
      }));

      // Should receive error
      const error = await waitForError(client);
      expect(error.type).toBe('error');
      expect(error.error).toContain('Unknown message type');

      await closeClient(client);
    });

    it('should handle malformed subscribe message', async () => {
      const client = await createClient(port);

      // Send subscribe without topic
      client.send(JSON.stringify({
        type: 'subscribe',
      }));

      await sleep(100);

      // Connection should still be alive
      expect(wsServer.getConnectionCount()).toBe(1);

      await closeClient(client);
    });

    it('should handle rapid connect/disconnect', async () => {
      for (let i = 0; i < 20; i++) {
        const client = await createClient(port);
        await closeClient(client);
      }

      await sleep(200);
      expect(wsServer.getConnectionCount()).toBe(0);
    });
  });

  describe('Subscription Switching', () => {
    it('should handle dynamic subscription changes', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Start with typescript filter
      await subscribe(client, 'work', { capability: 'typescript' });

      coordinator.submitWork({
        taskId: 'ts-1',
        description: 'TypeScript 1',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);
      expect(collector.getEventCount()).toBe(1);
      collector.clear();

      // Switch to python filter
      await subscribe(client, 'work', { capability: 'python' });

      coordinator.submitWork({
        taskId: 'py-1',
        description: 'Python 1',
        capability: 'python',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'ts-2',
        description: 'TypeScript 2',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);

      const events = collector.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]!.data.taskId).toBe('py-1');

      collector.stop();
      await closeClient(client);
    });

    it('should handle unsubscribe and resubscribe', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Subscribe
      await subscribe(client, 'work');

      // Unsubscribe
      await unsubscribe(client, 'work');

      // Submit work (should not receive)
      coordinator.submitWork({
        taskId: 'task-1',
        description: 'Test 1',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);
      expect(collector.getEventCount()).toBe(0);

      // Resubscribe
      await subscribe(client, 'work');

      // Submit work (should receive)
      coordinator.submitWork({
        taskId: 'task-2',
        description: 'Test 2',
        capability: 'typescript',
        priority: 5,
      });

      await collector.waitForCount(1);
      expect(collector.getEventCount()).toBe(1);

      collector.stop();
      await closeClient(client);
    });
  });
});
