/**
 * Subscription Manager
 *
 * Manages WebSocket client subscriptions and event filtering.
 * Tracks which clients are subscribed to which topics with filters.
 */

import type {
  Topic,
  EventFilter,
  WorkFilter,
  AgentFilter,
  TargetFilter,
} from './protocol.js';
import type { CoordinatorEvent } from '@loominal/shared';

/**
 * Subscription record
 */
export interface Subscription {
  topic: Topic;
  filter?: EventFilter;
  subscribedAt: Date;
}

/**
 * Subscription manager
 * Tracks subscriptions per connection and filters events
 */
export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription[]>();

  /**
   * Subscribe a connection to a topic
   */
  subscribe(connectionId: string, topic: Topic, filter?: EventFilter): void {
    const subs = this.subscriptions.get(connectionId) || [];

    // Remove any existing subscription to the same topic
    const filtered = subs.filter(s => s.topic !== topic);

    // Add new subscription
    filtered.push({
      topic,
      filter,
      subscribedAt: new Date(),
    });

    this.subscriptions.set(connectionId, filtered);
  }

  /**
   * Unsubscribe a connection from a topic
   */
  unsubscribe(connectionId: string, topic: Topic): boolean {
    const subs = this.subscriptions.get(connectionId);
    if (!subs) {
      return false;
    }

    const filtered = subs.filter(s => s.topic !== topic);

    // If nothing changed, subscription didn't exist
    if (filtered.length === subs.length) {
      return false;
    }

    if (filtered.length === 0) {
      this.subscriptions.delete(connectionId);
    } else {
      this.subscriptions.set(connectionId, filtered);
    }

    return true;
  }

  /**
   * Unsubscribe a connection from all topics
   */
  unsubscribeAll(connectionId: string): void {
    this.subscriptions.delete(connectionId);
  }

  /**
   * Get all subscribers for a topic that match the event
   */
  getSubscribers(topic: Topic, event: CoordinatorEvent): string[] {
    const subscribers: string[] = [];

    for (const [connectionId, subs] of this.subscriptions.entries()) {
      for (const sub of subs) {
        if (sub.topic === topic && this.matchesFilter(event, sub.filter, topic)) {
          subscribers.push(connectionId);
          break; // Only add connection once even if multiple subscriptions match
        }
      }
    }

    return subscribers;
  }

  /**
   * Get all subscribers for stats topic
   */
  getStatsSubscribers(): string[] {
    const subscribers: string[] = [];

    for (const [connectionId, subs] of this.subscriptions.entries()) {
      if (subs.some(s => s.topic === 'stats')) {
        subscribers.push(connectionId);
      }
    }

    return subscribers;
  }

  /**
   * Get subscriptions for a connection
   */
  getSubscriptions(connectionId: string): Subscription[] {
    return this.subscriptions.get(connectionId) || [];
  }

  /**
   * Get total number of subscriptions across all connections
   */
  getTotalSubscriptions(): number {
    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.length;
    }
    return total;
  }

  /**
   * Get number of connections with subscriptions
   */
  getConnectionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Check if event matches subscription filter
   */
  private matchesFilter(
    event: CoordinatorEvent,
    filter: EventFilter | undefined,
    topic: Topic
  ): boolean {
    // No filter means all events for this topic match
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }

    // Apply topic-specific filters
    switch (topic) {
      case 'work':
        return this.matchesWorkFilter(event, filter as WorkFilter);
      case 'agents':
        return this.matchesAgentFilter(event, filter as AgentFilter);
      case 'targets':
        return this.matchesTargetFilter(event, filter as TargetFilter);
      case 'stats':
        // Stats has no filtering
        return true;
      default:
        return true;
    }
  }

  /**
   * Check if event matches work filter
   */
  private matchesWorkFilter(event: CoordinatorEvent, filter: WorkFilter): boolean {
    // Only process work events
    if (!event.type.startsWith('work:')) {
      return false;
    }

    const workEvent = event as any;

    // Filter by status
    if (filter.status) {
      // Map event types to statuses
      const eventToStatus: Record<string, string> = {
        'work:submitted': 'pending',
        'work:assigned': 'assigned',
        'work:started': 'in-progress',
        'work:progress': 'in-progress',
        'work:completed': 'completed',
        'work:failed': 'failed',
        'work:cancelled': 'cancelled',
      };

      const eventStatus = eventToStatus[event.type];
      if (eventStatus !== filter.status) {
        return false;
      }
    }

    // Filter by capability
    if (filter.capability && workEvent.capability !== filter.capability) {
      return false;
    }

    // Filter by boundary
    if (filter.boundary && workEvent.boundary !== filter.boundary) {
      return false;
    }

    // Filter by task ID
    if (filter.taskId && workEvent.taskId !== filter.taskId) {
      return false;
    }

    // Filter by assignedTo
    if (filter.assignedTo && workEvent.assignedTo !== filter.assignedTo) {
      return false;
    }

    return true;
  }

  /**
   * Check if event matches agent filter
   */
  private matchesAgentFilter(event: CoordinatorEvent, filter: AgentFilter): boolean {
    // Only process agent events
    if (!event.type.startsWith('agent:')) {
      return false;
    }

    const agentEvent = event as any;

    // Filter by agent type
    if (filter.agentType && agentEvent.agent?.agentType !== filter.agentType) {
      return false;
    }

    // Filter by status
    if (filter.status) {
      // For updated events, check newStatus
      if (event.type === 'agent:updated' && agentEvent.newStatus !== filter.status) {
        return false;
      }
      // For registered events, check status
      if (event.type === 'agent:registered' && agentEvent.status !== filter.status) {
        return false;
      }
      // For shutdown events, status is always 'offline'
      if (event.type === 'agent:shutdown' && filter.status !== 'offline') {
        return false;
      }
    }

    // Filter by capability
    if (filter.capability && !agentEvent.capabilities?.includes(filter.capability)) {
      return false;
    }

    // Filter by boundary
    if (filter.boundary && !agentEvent.boundaries?.includes(filter.boundary)) {
      return false;
    }

    // Filter by GUID
    if (filter.guid && agentEvent.agent?.guid !== filter.guid) {
      return false;
    }

    return true;
  }

  /**
   * Check if event matches target filter
   */
  private matchesTargetFilter(event: CoordinatorEvent, filter: TargetFilter): boolean {
    // Process target and spin-up events
    if (!event.type.startsWith('target:') && !event.type.startsWith('spin-up:')) {
      return false;
    }

    const targetEvent = event as any;

    // Filter by agent type
    if (filter.agentType && targetEvent.agentType !== filter.agentType) {
      return false;
    }

    // Filter by status
    if (filter.status) {
      // For updated events, check newStatus
      if (event.type === 'target:updated' && targetEvent.newStatus !== filter.status) {
        return false;
      }
      // For registered events, assume available
      if (event.type === 'target:registered' && filter.status !== 'available') {
        return false;
      }
      // For disabled events, status is 'disabled'
      if (event.type === 'target:disabled' && filter.status !== 'disabled') {
        return false;
      }
    }

    // Filter by capability
    if (filter.capability && !targetEvent.capabilities?.includes(filter.capability)) {
      return false;
    }

    // Filter by boundary
    if (filter.boundary && !targetEvent.boundaries?.includes(filter.boundary)) {
      return false;
    }

    // Filter by mechanism
    if (filter.mechanism && targetEvent.mechanism !== filter.mechanism) {
      return false;
    }

    // Filter by target ID
    if (filter.targetId && targetEvent.targetId !== filter.targetId) {
      return false;
    }

    return true;
  }
}
