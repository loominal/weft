/**
 * Semantic Context Types for Agent Details and Responses
 *
 * These types provide a unified way to embed resolved agent information
 * in API responses, enabling clients to understand who performed actions
 * and which agent is assigned to work items.
 */

import type { AgentType } from './work-item.js';
import type { CoordinatedWorkItem } from './work-item.js';
import type { SpinUpTarget } from './spin-up-target.js';

/**
 * Summary information about an agent
 *
 * Used to provide context about which agent performed an action or
 * is assigned to work. Contains the essential identifying information
 * without the full registered agent details.
 */
export interface AgentSummary {
  /** Unique agent identifier (UUID) */
  guid: string;

  /** Agent handle/username */
  handle?: string;

  /** Agent type (copilot-cli or claude-code) */
  agentType: AgentType;

  /** Hostname where agent is running */
  hostname?: string;
}

/**
 * Work item response with assigned agent details
 *
 * Extends CoordinatedWorkItem with resolved agent information
 * for the agent assigned to this work.
 */
export interface WorkItemResponse extends CoordinatedWorkItem {
  /** Resolved agent details if assigned */
  assignedToAgent?: AgentSummary;
}

/**
 * Spin-up event information
 */
export interface SpinUpEvent {
  /** When the spin-up occurred */
  time: string;

  /** Which agent performed the spin-up (if known) */
  agent?: AgentSummary;

  /** Work item ID that triggered the spin-up */
  workItemId?: string;

  /** Outcome of the spin-up attempt */
  outcome: 'success' | 'failure';

  /** Error message if outcome was failure */
  error?: string;
}

/**
 * Spin-up target response with agent context
 *
 * Extends SpinUpTarget with historical information about the last
 * time this target was used for spin-up.
 */
export interface TargetResponse extends SpinUpTarget {
  /** Information about the last spin-up from this target */
  lastSpinUp?: SpinUpEvent;
}

/**
 * Channel message response with sender context
 *
 * Provides both the original sender GUID and resolved agent details
 * for better context about who sent the message.
 */
export interface ChannelMessageResponse {
  /** Original sender agent GUID */
  sender: string;

  /** Resolved sender agent details */
  senderAgent?: AgentSummary;

  /** Message content */
  content: string;

  /** Message timestamp (ISO 8601) */
  timestamp: string;

  /** Channel the message was sent to */
  channel?: string;

  /** Message ID for tracking */
  messageId?: string;
}
