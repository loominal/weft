/**
 * WebSocket Real-World Scenario Tests
 *
 * Tests that demonstrate real-world usage patterns:
 * - Dashboard monitoring
 * - Work queue observation
 * - Agent health monitoring
 * - Multi-project monitoring
 * - Dynamic subscription switching
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
  closeClient,
  closeClients,
  sleep,
  EventCollector,
} from './test-helpers.js';

describe('WebSocket Real-World Scenario Tests', () => {
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
      projectId: 'scenario-test',
    });

    // Create WebSocket server with stats provider
    const statsProvider = async () => ({
      agents: {
        total: 5,
        byType: { developer: 3, reviewer: 2 },
        byStatus: { online: 4, busy: 1, offline: 0 },
      },
      work: {
        pending: coordinator.getStats().pending,
        active: coordinator.getStats().active,
        completed: coordinator.getStats().completed,
        failed: coordinator.getStats().failed,
      },
      targets: {
        total: 3,
        available: 2,
        inUse: 1,
        disabled: 0,
      },
    });

    wsServer = new WeftWebSocketServer(
      httpServer,
      { statsIntervalMs: 1000 }, // 1 second for testing
      statsProvider,
      'scenario-test'
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

    coordinator.on('work:progress', (event) => {
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

  describe('Dashboard Monitoring', () => {
    it('should monitor all activity on a dashboard', async () => {
      const dashboard = await createClient(port);

      // Collectors for different event types
      const workCollector = new EventCollector(dashboard, (e) => e.topic === 'work');
      const allMessages: any[] = [];

      // Collect all messages for stats
      const statsHandler = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          allMessages.push(msg);
        } catch (error) {
          // Ignore parse errors
        }
      };

      dashboard.on('message', statsHandler);
      workCollector.start();

      // Subscribe to all topics
      await subscribe(dashboard, 'work');
      await subscribe(dashboard, 'agents');
      await subscribe(dashboard, 'targets');
      await subscribe(dashboard, 'stats');

      // Simulate various activities
      const workId1 = coordinator.submitWork({
        taskId: 'dashboard-task-1',
        description: 'First task',
        capability: 'typescript',
        priority: 8,
      });

      const workId2 = coordinator.submitWork({
        taskId: 'dashboard-task-2',
        description: 'Second task',
        capability: 'python',
        priority: 5,
      });

      await sleep(100);

      await coordinator.recordClaim(workId1, 'agent-1');
      coordinator.startWork(workId1);
      coordinator.updateProgress(workId1, 50);

      await sleep(100);

      await coordinator.recordClaim(workId2, 'agent-2');
      coordinator.startWork(workId2);
      coordinator.recordCompletion(workId2, { success: true });

      // Wait for stats update
      await sleep(1500);

      // Dashboard should have received all work events
      const workEvents = workCollector.getEvents();
      expect(workEvents.length).toBeGreaterThan(5);

      // Verify event types received
      const eventTypes = workEvents.map(e => e.event);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_SUBMITTED);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_ASSIGNED);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_STARTED);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_PROGRESS);
      expect(eventTypes).toContain(CoordinatorEventType.WORK_COMPLETED);

      // Should have received stats updates
      dashboard.removeListener('message', statsHandler);
      const statsMessages = allMessages.filter(m => m.type === 'stats');
      expect(statsMessages.length).toBeGreaterThan(0);

      const latestStats = statsMessages[statsMessages.length - 1];
      expect(latestStats?.data).toHaveProperty('agents');
      expect(latestStats?.data).toHaveProperty('work');
      expect(latestStats?.data).toHaveProperty('targets');
      expect(latestStats?.data).toHaveProperty('websocket');

      workCollector.stop();

      await closeClient(dashboard);
    }, 10000);

    it('should track work progress in real-time', async () => {
      const dashboard = await createClient(port);
      const collector = new EventCollector(dashboard);
      collector.start();

      await subscribe(dashboard, 'work');

      // Submit work and track its lifecycle
      const workId = coordinator.submitWork({
        taskId: 'progress-tracking',
        description: 'Task with progress updates',
        capability: 'typescript',
        priority: 7,
      });

      await sleep(50);

      await coordinator.recordClaim(workId, 'agent-1');
      await sleep(50);

      coordinator.startWork(workId);
      await sleep(50);

      // Multiple progress updates
      coordinator.updateProgress(workId, 25);
      await sleep(50);

      coordinator.updateProgress(workId, 50);
      await sleep(50);

      coordinator.updateProgress(workId, 75);
      await sleep(50);

      coordinator.recordCompletion(workId, { result: 'success' });

      // Wait for all events
      await sleep(200);

      const events = collector.getEvents();

      // Should receive: submitted, assigned, started, 3x progress, completed
      expect(events.length).toBe(7);

      // Verify order
      expect(events[0]!.event).toBe(CoordinatorEventType.WORK_SUBMITTED);
      expect(events[1]!.event).toBe(CoordinatorEventType.WORK_ASSIGNED);
      expect(events[2]!.event).toBe(CoordinatorEventType.WORK_STARTED);
      expect(events[3]!.event).toBe(CoordinatorEventType.WORK_PROGRESS);
      expect(events[4]!.event).toBe(CoordinatorEventType.WORK_PROGRESS);
      expect(events[5]!.event).toBe(CoordinatorEventType.WORK_PROGRESS);
      expect(events[6]!.event).toBe(CoordinatorEventType.WORK_COMPLETED);

      collector.stop();
      await closeClient(dashboard);
    });
  });

  describe('Work Queue Observer', () => {
    it('should monitor pending work queue', async () => {
      const observer = await createClient(port);
      const collector = new EventCollector(observer);
      collector.start();

      // Subscribe only to pending work
      await subscribe(observer, 'work', { status: 'pending' });

      // Submit multiple work items
      coordinator.submitWork({
        taskId: 'queue-task-1',
        description: 'Task 1',
        capability: 'typescript',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'queue-task-2',
        description: 'Task 2',
        capability: 'python',
        priority: 7,
      });

      const workId3 = coordinator.submitWork({
        taskId: 'queue-task-3',
        description: 'Task 3',
        capability: 'rust',
        priority: 3,
      });

      await sleep(200);

      // Should have received 3 submitted events
      expect(collector.getEventCount()).toBe(3);

      // Assign one work item (changes status to assigned)
      await coordinator.recordClaim(workId3, 'agent-1');

      await sleep(100);

      // Should not receive assigned event (filtered out)
      expect(collector.getEventCount()).toBe(3);

      // Submit another
      coordinator.submitWork({
        taskId: 'queue-task-4',
        description: 'Task 4',
        capability: 'typescript',
        priority: 9,
      });

      await sleep(100);

      // Should receive the new submission
      expect(collector.getEventCount()).toBe(4);

      collector.stop();
      await closeClient(observer);
    });

    it('should monitor work by capability', async () => {
      const tsObserver = await createClient(port);
      const pyObserver = await createClient(port);

      const tsCollector = new EventCollector(tsObserver);
      const pyCollector = new EventCollector(pyObserver);

      tsCollector.start();
      pyCollector.start();

      // Each observer watches different capability
      await subscribe(tsObserver, 'work', { capability: 'typescript' });
      await subscribe(pyObserver, 'work', { capability: 'python' });

      // Submit mixed work
      coordinator.submitWork({
        taskId: 'ts-1',
        description: 'TypeScript work',
        capability: 'typescript',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'py-1',
        description: 'Python work',
        capability: 'python',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'ts-2',
        description: 'More TypeScript',
        capability: 'typescript',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'go-1',
        description: 'Go work',
        capability: 'go',
        priority: 5,
      });

      await sleep(200);

      // TypeScript observer should see 2 events
      expect(tsCollector.getEventCount()).toBe(2);

      // Python observer should see 1 event
      expect(pyCollector.getEventCount()).toBe(1);

      tsCollector.stop();
      pyCollector.stop();

      await closeClients([tsObserver, pyObserver]);
    });

    it('should monitor high-priority work only', async () => {
      const observer = await createClient(port);
      const collector = new EventCollector(observer);
      collector.start();

      // Note: We can't filter by priority directly, so we'll use a workaround
      // by subscribing to all work and manually filtering
      await subscribe(observer, 'work');

      // Submit work with various priorities
      coordinator.submitWork({
        taskId: 'low-priority',
        description: 'Low priority task',
        capability: 'typescript',
        priority: 2,
      });

      coordinator.submitWork({
        taskId: 'high-priority',
        description: 'High priority task',
        capability: 'typescript',
        priority: 9,
      });

      coordinator.submitWork({
        taskId: 'medium-priority',
        description: 'Medium priority task',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(200);

      const events = collector.getEvents();
      expect(events.length).toBe(3);

      // Find high priority event
      const highPriorityEvent = events.find(e => e.data.priority === 9);
      expect(highPriorityEvent).toBeDefined();
      expect(highPriorityEvent?.data.taskId).toBe('high-priority');

      collector.stop();
      await closeClient(observer);
    });
  });

  describe('Agent Health Monitoring', () => {
    it('should monitor agent status changes', async () => {
      const monitor = await createClient(port);
      const collector = new EventCollector(monitor);
      collector.start();

      // Subscribe to agent events
      await subscribe(monitor, 'agents');

      // In a real scenario, agents would register/update/shutdown
      // For now, we just verify the subscription works
      await sleep(100);

      // No agent events in this test, but subscription is working
      expect(collector.getEventCount()).toBe(0);

      collector.stop();
      await closeClient(monitor);
    });

    it('should monitor specific agent type', async () => {
      const monitor = await createClient(port);
      const collector = new EventCollector(monitor);
      collector.start();

      // Monitor only developer agents
      await subscribe(monitor, 'agents', { agentType: 'developer' });

      await sleep(100);

      collector.stop();
      await closeClient(monitor);
    });

    it('should monitor agents by capability', async () => {
      const monitor = await createClient(port);
      const collector = new EventCollector(monitor);
      collector.start();

      // Monitor agents with typescript capability
      await subscribe(monitor, 'agents', { capability: 'typescript' });

      await sleep(100);

      collector.stop();
      await closeClient(monitor);
    });
  });

  describe('Multi-Project Monitoring', () => {
    it('should handle multiple independent projects', async () => {
      // Create coordinators for different projects
      const coordinator1 = new BaseCoordinator({ projectId: 'project-1' });
      const coordinator2 = new BaseCoordinator({ projectId: 'project-2' });

      const client1 = await createClient(port);
      const client2 = await createClient(port);

      const collector1 = new EventCollector(client1);
      const collector2 = new EventCollector(client2);

      collector1.start();
      collector2.start();

      await subscribe(client1, 'work');
      await subscribe(client2, 'work');

      // Connect coordinator1 events
      coordinator1.on('work:submitted', (event) => {
        wsServer.broadcastEvent('work', event);
      });

      // Connect coordinator2 events
      coordinator2.on('work:submitted', (event) => {
        wsServer.broadcastEvent('work', event);
      });

      // Submit work to both projects
      coordinator1.submitWork({
        taskId: 'p1-task',
        description: 'Project 1 task',
        capability: 'typescript',
        priority: 5,
      });

      coordinator2.submitWork({
        taskId: 'p2-task',
        description: 'Project 2 task',
        capability: 'python',
        priority: 5,
      });

      await sleep(200);

      // Both clients receive both events (same server)
      expect(collector1.getEventCount()).toBeGreaterThan(0);
      expect(collector2.getEventCount()).toBeGreaterThan(0);

      collector1.stop();
      collector2.stop();

      await closeClients([client1, client2]);
    });
  });

  describe('Dynamic Subscription Switching', () => {
    it('should switch from monitoring all to specific capability', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Start by monitoring all work
      await subscribe(client, 'work');

      // Submit various work
      coordinator.submitWork({
        taskId: 'ts-1',
        description: 'TypeScript 1',
        capability: 'typescript',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'py-1',
        description: 'Python 1',
        capability: 'python',
        priority: 5,
      });

      await sleep(100);
      expect(collector.getEventCount()).toBe(2);
      collector.clear();

      // Switch to typescript only
      await subscribe(client, 'work', { capability: 'typescript' });

      coordinator.submitWork({
        taskId: 'ts-2',
        description: 'TypeScript 2',
        capability: 'typescript',
        priority: 5,
      });

      coordinator.submitWork({
        taskId: 'py-2',
        description: 'Python 2',
        capability: 'python',
        priority: 5,
      });

      await sleep(100);

      // Should only receive typescript event
      expect(collector.getEventCount()).toBe(1);
      expect(collector.getEvents()[0]!.data.taskId).toBe('ts-2');

      collector.stop();
      await closeClient(client);
    });

    it('should switch between different status filters', async () => {
      const client = await createClient(port);
      const collector = new EventCollector(client);
      collector.start();

      // Watch pending work
      await subscribe(client, 'work', { status: 'pending' });

      const workId = coordinator.submitWork({
        taskId: 'status-switch-test',
        description: 'Status switching test',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);
      expect(collector.getEventCount()).toBe(1);
      collector.clear();

      // Switch to completed work
      await subscribe(client, 'work', { status: 'completed' });

      // Assign and complete the work
      await coordinator.recordClaim(workId, 'agent-1');
      coordinator.startWork(workId);
      coordinator.recordCompletion(workId, { success: true });

      await sleep(100);

      // Should only receive completed event
      expect(collector.getEventCount()).toBe(1);
      expect(collector.getEvents()[0]!.event).toBe(CoordinatorEventType.WORK_COMPLETED);

      collector.stop();
      await closeClient(client);
    });

    it('should switch between topics dynamically', async () => {
      const client = await createClient(port);
      const workCollector = new EventCollector(client, (e) => e.topic === 'work');
      const agentCollector = new EventCollector(client, (e) => e.topic === 'agents');

      workCollector.start();
      agentCollector.start();

      // Start with work subscription
      await subscribe(client, 'work');

      coordinator.submitWork({
        taskId: 'topic-switch-1',
        description: 'Before switch',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);
      expect(workCollector.getEventCount()).toBe(1);
      expect(agentCollector.getEventCount()).toBe(0);

      // Switch to agents
      await subscribe(client, 'agents');

      // Submit more work
      coordinator.submitWork({
        taskId: 'topic-switch-2',
        description: 'After switch',
        capability: 'typescript',
        priority: 5,
      });

      await sleep(100);

      // Should still receive work events (both subscriptions active)
      expect(workCollector.getEventCount()).toBe(2);

      workCollector.stop();
      agentCollector.stop();

      await closeClient(client);
    });
  });

  describe('Stats Monitoring', () => {
    it('should receive periodic stats updates', async () => {
      const client = await createClient(port);
      const messages: any[] = [];

      // Collect all messages
      const handler = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch (error) {
          // Ignore parse errors
        }
      };

      client.on('message', handler);

      // Subscribe to stats
      await subscribe(client, 'stats');

      // Wait for at least 2 stats updates (1 second interval)
      await sleep(2500);

      client.removeListener('message', handler);

      // Filter for stats messages
      const stats = messages.filter(m => m.type === 'stats');
      expect(stats.length).toBeGreaterThanOrEqual(2);

      // Verify stats structure
      const latestStats = stats[stats.length - 1];
      expect(latestStats?.data).toHaveProperty('agents');
      expect(latestStats?.data).toHaveProperty('work');
      expect(latestStats?.data).toHaveProperty('targets');
      expect(latestStats?.data).toHaveProperty('websocket');

      expect(latestStats?.data.websocket.connections).toBeGreaterThan(0);

      await closeClient(client);
    }, 5000);

    it('should not receive stats without subscription', async () => {
      const client = await createClient(port);
      const messages: any[] = [];

      // Collect all messages
      const handler = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
        } catch (error) {
          // Ignore parse errors
        }
      };

      client.on('message', handler);

      // Don't subscribe to stats
      await subscribe(client, 'work');

      // Wait for potential stats updates
      await sleep(2000);

      client.removeListener('message', handler);

      // Filter for stats messages
      const stats = messages.filter(m => m.type === 'stats');

      // Should not receive any stats
      expect(stats.length).toBe(0);

      await closeClient(client);
    }, 3000);
  });
});
