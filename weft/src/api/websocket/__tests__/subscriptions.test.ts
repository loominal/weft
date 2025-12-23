/**
 * Tests for WebSocket Subscription Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionManager } from '../subscriptions.js';
import { Topic } from '../protocol.js';
import { CoordinatorEventType } from '@loominal/shared';
import type {
  WorkSubmittedEvent,
  WorkAssignedEvent,
  AgentRegisteredEvent,
  AgentUpdatedEvent,
  TargetRegisteredEvent,
  TargetUpdatedEvent,
} from '@loominal/shared';

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    manager = new SubscriptionManager();
  });

  describe('Basic subscription management', () => {
    it('should subscribe a connection to a topic', () => {
      manager.subscribe('conn1', Topic.WORK);
      const subs = manager.getSubscriptions('conn1');

      expect(subs).toHaveLength(1);
      expect(subs[0]!.topic).toBe(Topic.WORK);
      expect(subs[0]!.filter).toBeUndefined();
    });

    it('should subscribe with a filter', () => {
      manager.subscribe('conn1', Topic.WORK, { status: 'pending' });
      const subs = manager.getSubscriptions('conn1');

      expect(subs).toHaveLength(1);
      expect(subs[0]!.filter).toEqual({ status: 'pending' });
    });

    it('should replace existing subscription to same topic', () => {
      manager.subscribe('conn1', Topic.WORK, { status: 'pending' });
      manager.subscribe('conn1', Topic.WORK, { status: 'completed' });
      const subs = manager.getSubscriptions('conn1');

      expect(subs).toHaveLength(1);
      expect(subs[0]!.filter).toEqual({ status: 'completed' });
    });

    it('should allow multiple subscriptions to different topics', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn1', Topic.AGENTS);
      const subs = manager.getSubscriptions('conn1');

      expect(subs).toHaveLength(2);
      expect(subs.map(s => s.topic)).toContain(Topic.WORK);
      expect(subs.map(s => s.topic)).toContain(Topic.AGENTS);
    });

    it('should unsubscribe from a topic', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn1', Topic.AGENTS);

      const result = manager.unsubscribe('conn1', Topic.WORK);
      const subs = manager.getSubscriptions('conn1');

      expect(result).toBe(true);
      expect(subs).toHaveLength(1);
      expect(subs[0]!.topic).toBe(Topic.AGENTS);
    });

    it('should return false when unsubscribing from non-existent subscription', () => {
      const result = manager.unsubscribe('conn1', Topic.WORK);
      expect(result).toBe(false);
    });

    it('should unsubscribe all topics', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn1', Topic.AGENTS);
      manager.subscribe('conn1', Topic.TARGETS);

      manager.unsubscribeAll('conn1');
      const subs = manager.getSubscriptions('conn1');

      expect(subs).toHaveLength(0);
    });
  });

  describe('Subscriber retrieval', () => {
    it('should get subscribers for a topic without filter', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn2', Topic.AGENTS);
      manager.subscribe('conn3', Topic.WORK);

      const event: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'general',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(2);
      expect(subscribers).toContain('conn1');
      expect(subscribers).toContain('conn3');
      expect(subscribers).not.toContain('conn2');
    });

    it('should get stats subscribers', () => {
      manager.subscribe('conn1', Topic.STATS);
      manager.subscribe('conn2', Topic.WORK);
      manager.subscribe('conn3', Topic.STATS);

      const subscribers = manager.getStatsSubscribers();

      expect(subscribers).toHaveLength(2);
      expect(subscribers).toContain('conn1');
      expect(subscribers).toContain('conn3');
    });

    it('should only return each connection once even with multiple matching subscriptions', () => {
      manager.subscribe('conn1', Topic.WORK);

      const event: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'general',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });
  });

  describe('Work event filtering', () => {
    it('should filter work events by status', () => {
      manager.subscribe('conn1', Topic.WORK, { status: 'pending' });
      manager.subscribe('conn2', Topic.WORK, { status: 'completed' });

      const submittedEvent: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'general',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, submittedEvent);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter work events by capability', () => {
      manager.subscribe('conn1', Topic.WORK, { capability: 'typescript' });
      manager.subscribe('conn2', Topic.WORK, { capability: 'python' });

      const event: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter work events by boundary', () => {
      manager.subscribe('conn1', Topic.WORK, { boundary: 'personal' });
      manager.subscribe('conn2', Topic.WORK, { boundary: 'corporate' });

      const event: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'general',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter work events by taskId', () => {
      manager.subscribe('conn1', Topic.WORK, { taskId: 'task-1' });
      manager.subscribe('conn2', Topic.WORK, { taskId: 'task-2' });

      const event: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'general',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter work events by assignedTo', () => {
      manager.subscribe('conn1', Topic.WORK, { assignedTo: 'agent-1' });
      manager.subscribe('conn2', Topic.WORK, { assignedTo: 'agent-2' });

      const event: WorkAssignedEvent = {
        type: CoordinatorEventType.WORK_ASSIGNED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        assignedTo: 'agent-1',
        assignedToAgent: {
          guid: 'agent-1',
          handle: 'agent-1',
          agentType: 'developer',
          hostname: 'localhost',
        },
        capability: 'general',
        boundary: 'personal',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should match multiple filters', () => {
      manager.subscribe('conn1', Topic.WORK, {
        status: 'pending',
        capability: 'typescript',
        boundary: 'personal',
      });

      const event: WorkSubmittedEvent = {
        type: CoordinatorEventType.WORK_SUBMITTED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        workId: 'work-1',
        taskId: 'task-1',
        capability: 'typescript',
        boundary: 'personal',
        priority: 5,
        description: 'Test work',
      };

      const subscribers = manager.getSubscribers(Topic.WORK, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });
  });

  describe('Agent event filtering', () => {
    it('should filter agent events by agentType', () => {
      manager.subscribe('conn1', Topic.AGENTS, { agentType: 'developer' });
      manager.subscribe('conn2', Topic.AGENTS, { agentType: 'reviewer' });

      const event: AgentRegisteredEvent = {
        type: CoordinatorEventType.AGENT_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        agent: {
          guid: 'agent-1',
          handle: 'dev-1',
          agentType: 'developer',
          hostname: 'localhost',
        },
        capabilities: ['typescript'],
        boundaries: ['personal'],
        status: 'online',
      };

      const subscribers = manager.getSubscribers(Topic.AGENTS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter agent events by status', () => {
      manager.subscribe('conn1', Topic.AGENTS, { status: 'online' });
      manager.subscribe('conn2', Topic.AGENTS, { status: 'offline' });

      const event: AgentRegisteredEvent = {
        type: CoordinatorEventType.AGENT_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        agent: {
          guid: 'agent-1',
          handle: 'dev-1',
          agentType: 'developer',
          hostname: 'localhost',
        },
        capabilities: ['typescript'],
        boundaries: ['personal'],
        status: 'online',
      };

      const subscribers = manager.getSubscribers(Topic.AGENTS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter agent updated events by new status', () => {
      manager.subscribe('conn1', Topic.AGENTS, { status: 'busy' });
      manager.subscribe('conn2', Topic.AGENTS, { status: 'online' });

      const event: AgentUpdatedEvent = {
        type: CoordinatorEventType.AGENT_UPDATED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        agent: {
          guid: 'agent-1',
          handle: 'dev-1',
          agentType: 'developer',
          hostname: 'localhost',
        },
        previousStatus: 'online',
        newStatus: 'busy',
        currentTaskCount: 1,
      };

      const subscribers = manager.getSubscribers(Topic.AGENTS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter agent events by capability', () => {
      manager.subscribe('conn1', Topic.AGENTS, { capability: 'typescript' });
      manager.subscribe('conn2', Topic.AGENTS, { capability: 'python' });

      const event: AgentRegisteredEvent = {
        type: CoordinatorEventType.AGENT_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        agent: {
          guid: 'agent-1',
          handle: 'dev-1',
          agentType: 'developer',
          hostname: 'localhost',
        },
        capabilities: ['typescript', 'javascript'],
        boundaries: ['personal'],
        status: 'online',
      };

      const subscribers = manager.getSubscribers(Topic.AGENTS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter agent events by GUID', () => {
      manager.subscribe('conn1', Topic.AGENTS, { guid: 'agent-1' });
      manager.subscribe('conn2', Topic.AGENTS, { guid: 'agent-2' });

      const event: AgentRegisteredEvent = {
        type: CoordinatorEventType.AGENT_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        agent: {
          guid: 'agent-1',
          handle: 'dev-1',
          agentType: 'developer',
          hostname: 'localhost',
        },
        capabilities: ['typescript'],
        boundaries: ['personal'],
        status: 'online',
      };

      const subscribers = manager.getSubscribers(Topic.AGENTS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });
  });

  describe('Target event filtering', () => {
    it('should filter target events by agentType', () => {
      manager.subscribe('conn1', Topic.TARGETS, { agentType: 'developer' });
      manager.subscribe('conn2', Topic.TARGETS, { agentType: 'reviewer' });

      const event: TargetRegisteredEvent = {
        type: CoordinatorEventType.TARGET_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        targetId: 'target-1',
        targetName: 'Dev Target',
        agentType: 'developer',
        capabilities: ['typescript'],
        boundaries: ['personal'],
        mechanism: 'local',
      };

      const subscribers = manager.getSubscribers(Topic.TARGETS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter target events by status', () => {
      manager.subscribe('conn1', Topic.TARGETS, { status: 'available' });
      manager.subscribe('conn2', Topic.TARGETS, { status: 'disabled' });

      const event: TargetRegisteredEvent = {
        type: CoordinatorEventType.TARGET_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        targetId: 'target-1',
        targetName: 'Dev Target',
        agentType: 'developer',
        capabilities: ['typescript'],
        boundaries: ['personal'],
        mechanism: 'local',
      };

      const subscribers = manager.getSubscribers(Topic.TARGETS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter target events by mechanism', () => {
      manager.subscribe('conn1', Topic.TARGETS, { mechanism: 'local' });
      manager.subscribe('conn2', Topic.TARGETS, { mechanism: 'ssh' });

      const event: TargetRegisteredEvent = {
        type: CoordinatorEventType.TARGET_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        targetId: 'target-1',
        targetName: 'Dev Target',
        agentType: 'developer',
        capabilities: ['typescript'],
        boundaries: ['personal'],
        mechanism: 'local',
      };

      const subscribers = manager.getSubscribers(Topic.TARGETS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });

    it('should filter target events by targetId', () => {
      manager.subscribe('conn1', Topic.TARGETS, { targetId: 'target-1' });
      manager.subscribe('conn2', Topic.TARGETS, { targetId: 'target-2' });

      const event: TargetRegisteredEvent = {
        type: CoordinatorEventType.TARGET_REGISTERED,
        timestamp: new Date().toISOString(),
        projectId: 'test',
        targetId: 'target-1',
        targetName: 'Dev Target',
        agentType: 'developer',
        capabilities: ['typescript'],
        boundaries: ['personal'],
        mechanism: 'local',
      };

      const subscribers = manager.getSubscribers(Topic.TARGETS, event);

      expect(subscribers).toHaveLength(1);
      expect(subscribers).toContain('conn1');
    });
  });

  describe('Statistics', () => {
    it('should track total subscriptions', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn1', Topic.AGENTS);
      manager.subscribe('conn2', Topic.WORK);

      expect(manager.getTotalSubscriptions()).toBe(3);
    });

    it('should track connection count', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn2', Topic.AGENTS);
      manager.subscribe('conn3', Topic.TARGETS);

      expect(manager.getConnectionCount()).toBe(3);
    });

    it('should update stats after unsubscribe', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn1', Topic.AGENTS);
      manager.subscribe('conn2', Topic.WORK);

      manager.unsubscribe('conn1', Topic.WORK);

      expect(manager.getTotalSubscriptions()).toBe(2);
      expect(manager.getConnectionCount()).toBe(2);
    });

    it('should update stats after unsubscribeAll', () => {
      manager.subscribe('conn1', Topic.WORK);
      manager.subscribe('conn1', Topic.AGENTS);
      manager.subscribe('conn2', Topic.WORK);

      manager.unsubscribeAll('conn1');

      expect(manager.getTotalSubscriptions()).toBe(1);
      expect(manager.getConnectionCount()).toBe(1);
    });
  });
});
