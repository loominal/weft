/**
 * Coordinator Event Emission Tests
 *
 * Tests that the coordinator emits proper events for all state changes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseCoordinator } from '../base-coordinator.js';
import type {
  WorkSubmittedEvent,
  WorkAssignedEvent,
  WorkStartedEvent,
  WorkProgressEvent,
  WorkCompletedEvent,
  WorkFailedEvent,
  WorkCancelledEvent,
} from '@loominal/shared';

describe('Coordinator Events', () => {
  let coordinator: BaseCoordinator;

  beforeEach(() => {
    coordinator = new BaseCoordinator({
      projectId: 'test-project',
      staleThresholdMs: 300000,
      cleanupIntervalMs: 60000,
    });
  });

  afterEach(() => {
    coordinator.shutdown();
  });

  describe('work:submitted event', () => {
    it('should emit work:submitted event when work is submitted', (context) => {
      const events: WorkSubmittedEvent[] = [];

      coordinator.on('work:submitted', (event: WorkSubmittedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-123',
        description: 'Test task',
        capability: 'typescript',
        priority: 5,
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:submitted');
      expect(events[0].workId).toBe(workId);
      expect(events[0].taskId).toBe('task-123');
      expect(events[0].capability).toBe('typescript');
      expect(events[0].description).toBe('Test task');
      expect(events[0].priority).toBe(5);
      expect(events[0].projectId).toBe('test-project');
      expect(events[0].timestamp).toBeTruthy();
    });

    it('should include correct boundary in event', () => {
      const events: WorkSubmittedEvent[] = [];

      coordinator.on('work:submitted', (event: WorkSubmittedEvent) => {
        events.push(event);
      });

      coordinator.submitWork({
        taskId: 'task-456',
        description: 'Another task',
        capability: 'python',
      });

      expect(events[0].boundary).toBe('personal'); // Default boundary
    });
  });

  describe('work:assigned event', () => {
    it('should emit work:assigned event when work is claimed', async () => {
      const events: WorkAssignedEvent[] = [];

      coordinator.on('work:assigned', (event: WorkAssignedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-789',
        description: 'Assignable task',
        capability: 'testing',
      });

      const claimed = await coordinator.recordClaim(workId, 'agent-guid-123');

      expect(claimed).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:assigned');
      expect(events[0].workId).toBe(workId);
      expect(events[0].assignedTo).toBe('agent-guid-123');
      expect(events[0].assignedToAgent.guid).toBe('agent-guid-123');
      expect(events[0].capability).toBe('testing');
      expect(events[0].projectId).toBe('test-project');
    });

    it('should not emit event if claim fails', async () => {
      const events: WorkAssignedEvent[] = [];

      coordinator.on('work:assigned', (event: WorkAssignedEvent) => {
        events.push(event);
      });

      // Try to claim non-existent work
      const claimed = await coordinator.recordClaim('non-existent-id', 'agent-guid');

      expect(claimed).toBe(false);
      expect(events).toHaveLength(0);
    });

    it('should not emit event if work already assigned', async () => {
      const events: WorkAssignedEvent[] = [];

      const workId = coordinator.submitWork({
        taskId: 'task-double-claim',
        description: 'Test double claim',
        capability: 'testing',
      });

      await coordinator.recordClaim(workId, 'agent-1');

      coordinator.on('work:assigned', (event: WorkAssignedEvent) => {
        events.push(event);
      });

      // Try to claim already assigned work
      const claimed = await coordinator.recordClaim(workId, 'agent-2');

      expect(claimed).toBe(false);
      expect(events).toHaveLength(0);
    });
  });

  describe('work:started event', () => {
    it('should emit work:started event when work transitions to in-progress', async () => {
      const events: WorkStartedEvent[] = [];

      coordinator.on('work:started', (event: WorkStartedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-start',
        description: 'Startable task',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-start-123');
      const started = coordinator.startWork(workId);

      expect(started).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:started');
      expect(events[0].workId).toBe(workId);
      expect(events[0].assignedTo).toBe('agent-start-123');
      expect(events[0].assignedToAgent.guid).toBe('agent-start-123');
    });

    it('should not emit event if work not assigned', () => {
      const events: WorkStartedEvent[] = [];

      coordinator.on('work:started', (event: WorkStartedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-not-assigned',
        description: 'Not assigned',
        capability: 'coding',
      });

      const started = coordinator.startWork(workId);

      expect(started).toBe(false);
      expect(events).toHaveLength(0);
    });
  });

  describe('work:progress event', () => {
    it('should emit work:progress event when progress is updated', async () => {
      const events: WorkProgressEvent[] = [];

      coordinator.on('work:progress', (event: WorkProgressEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-progress',
        description: 'Progress task',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-progress');
      coordinator.updateProgress(workId, 50);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:progress');
      expect(events[0].workId).toBe(workId);
      expect(events[0].progress).toBe(50);
      expect(events[0].assignedTo).toBe('agent-progress');
    });

    it('should emit multiple progress events', async () => {
      const events: WorkProgressEvent[] = [];

      coordinator.on('work:progress', (event: WorkProgressEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-multi-progress',
        description: 'Multi-progress task',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-multi');
      coordinator.updateProgress(workId, 25);
      coordinator.updateProgress(workId, 50);
      coordinator.updateProgress(workId, 75);

      expect(events).toHaveLength(3);
      expect(events[0].progress).toBe(25);
      expect(events[1].progress).toBe(50);
      expect(events[2].progress).toBe(75);
    });

    it('should clamp progress to 0-100 range', async () => {
      const events: WorkProgressEvent[] = [];

      coordinator.on('work:progress', (event: WorkProgressEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-clamp',
        description: 'Clamp test',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-clamp');
      coordinator.updateProgress(workId, 150);
      coordinator.updateProgress(workId, -10);

      expect(events).toHaveLength(2);
      expect(events[0].progress).toBe(100);
      expect(events[1].progress).toBe(0);
    });
  });

  describe('work:completed event', () => {
    it('should emit work:completed event on successful completion', () => {
      const events: WorkCompletedEvent[] = [];

      coordinator.on('work:completed', (event: WorkCompletedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-complete',
        description: 'Completable task',
        capability: 'coding',
      });

      const completed = coordinator.recordCompletion(workId, { result: 'success' }, 'Done!');

      expect(completed).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:completed');
      expect(events[0].workId).toBe(workId);
      expect(events[0].summary).toBe('Done!');
      expect(events[0].projectId).toBe('test-project');
    });

    it('should include assigned agent in completion event', async () => {
      const events: WorkCompletedEvent[] = [];

      coordinator.on('work:completed', (event: WorkCompletedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-assigned-complete',
        description: 'Assigned completion',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-complete-123');
      coordinator.recordCompletion(workId, { result: 'done' });

      expect(events[0].assignedTo).toBe('agent-complete-123');
      expect(events[0].assignedToAgent?.guid).toBe('agent-complete-123');
    });
  });

  describe('work:failed event', () => {
    it('should emit work:failed event when work fails', async () => {
      const events: WorkFailedEvent[] = [];

      coordinator.on('work:failed', (event: WorkFailedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-fail',
        description: 'Failing task',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-fail');
      const failed = await coordinator.recordError(workId, 'Something went wrong', true);

      expect(failed).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:failed');
      expect(events[0].workId).toBe(workId);
      expect(events[0].errorMessage).toBe('Something went wrong');
      expect(events[0].recoverable).toBe(true);
      expect(events[0].assignedTo).toBe('agent-fail');
    });

    it('should handle non-recoverable errors', async () => {
      const events: WorkFailedEvent[] = [];

      coordinator.on('work:failed', (event: WorkFailedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-fatal',
        description: 'Fatal error task',
        capability: 'coding',
      });

      await coordinator.recordError(workId, 'Fatal error', false);

      expect(events[0].recoverable).toBe(false);
    });
  });

  describe('work:cancelled event', () => {
    it('should emit work:cancelled event when work is cancelled', () => {
      const events: WorkCancelledEvent[] = [];

      coordinator.on('work:cancelled', (event: WorkCancelledEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-cancel',
        description: 'Cancellable task',
        capability: 'coding',
      });

      const cancelled = coordinator.cancelWork(workId);

      expect(cancelled).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('work:cancelled');
      expect(events[0].workId).toBe(workId);
      expect(events[0].taskId).toBe('task-cancel');
    });

    it('should not emit event if work cannot be cancelled', () => {
      const events: WorkCancelledEvent[] = [];

      coordinator.on('work:cancelled', (event: WorkCancelledEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-completed-cancel',
        description: 'Already completed',
        capability: 'coding',
      });

      coordinator.recordCompletion(workId);
      const cancelled = coordinator.cancelWork(workId);

      expect(cancelled).toBe(false);
      expect(events).toHaveLength(0);
    });
  });

  describe('multiple listeners', () => {
    it('should support multiple event listeners', () => {
      const events1: WorkSubmittedEvent[] = [];
      const events2: WorkSubmittedEvent[] = [];

      coordinator.on('work:submitted', (event: WorkSubmittedEvent) => {
        events1.push(event);
      });

      coordinator.on('work:submitted', (event: WorkSubmittedEvent) => {
        events2.push(event);
      });

      coordinator.submitWork({
        taskId: 'task-multi-listener',
        description: 'Multi-listener test',
        capability: 'coding',
      });

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0].taskId).toBe('task-multi-listener');
      expect(events2[0].taskId).toBe('task-multi-listener');
    });
  });

  describe('event payload structure', () => {
    it('should include all required fields in work:submitted event', () => {
      const events: WorkSubmittedEvent[] = [];

      coordinator.on('work:submitted', (event: WorkSubmittedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-structure',
        description: 'Structure test',
        capability: 'testing',
        priority: 8,
      });

      const event = events[0];
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('projectId');
      expect(event).toHaveProperty('workId');
      expect(event).toHaveProperty('taskId');
      expect(event).toHaveProperty('capability');
      expect(event).toHaveProperty('boundary');
      expect(event).toHaveProperty('priority');
      expect(event).toHaveProperty('description');
    });

    it('should include all required fields in work:assigned event', async () => {
      const events: WorkAssignedEvent[] = [];

      coordinator.on('work:assigned', (event: WorkAssignedEvent) => {
        events.push(event);
      });

      const workId = coordinator.submitWork({
        taskId: 'task-assigned-structure',
        description: 'Assigned structure test',
        capability: 'testing',
      });

      await coordinator.recordClaim(workId, 'agent-struct');

      const event = events[0];
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('projectId');
      expect(event).toHaveProperty('workId');
      expect(event).toHaveProperty('taskId');
      expect(event).toHaveProperty('assignedTo');
      expect(event).toHaveProperty('assignedToAgent');
      expect(event).toHaveProperty('capability');
      expect(event).toHaveProperty('boundary');
      expect(event.assignedToAgent).toHaveProperty('guid');
      expect(event.assignedToAgent).toHaveProperty('agentType');
    });
  });

  describe('event ordering', () => {
    it('should emit events in correct order for work lifecycle', async () => {
      const allEvents: string[] = [];

      coordinator.on('work:submitted', () => allEvents.push('submitted'));
      coordinator.on('work:assigned', () => allEvents.push('assigned'));
      coordinator.on('work:started', () => allEvents.push('started'));
      coordinator.on('work:progress', () => allEvents.push('progress'));
      coordinator.on('work:completed', () => allEvents.push('completed'));

      const workId = coordinator.submitWork({
        taskId: 'task-lifecycle',
        description: 'Full lifecycle test',
        capability: 'coding',
      });

      await coordinator.recordClaim(workId, 'agent-lifecycle');
      coordinator.startWork(workId);
      coordinator.updateProgress(workId, 50);
      coordinator.recordCompletion(workId);

      expect(allEvents).toEqual(['submitted', 'assigned', 'started', 'progress', 'completed']);
    });
  });

  describe('shutdown', () => {
    it('should remove all listeners on shutdown', () => {
      const events: WorkSubmittedEvent[] = [];

      coordinator.on('work:submitted', (event: WorkSubmittedEvent) => {
        events.push(event);
      });

      coordinator.submitWork({
        taskId: 'task-before-shutdown',
        description: 'Before shutdown',
        capability: 'coding',
      });

      expect(events).toHaveLength(1);

      coordinator.shutdown();

      coordinator.submitWork({
        taskId: 'task-after-shutdown',
        description: 'After shutdown',
        capability: 'coding',
      });

      // No new events after shutdown
      expect(events).toHaveLength(1);
    });
  });
});
