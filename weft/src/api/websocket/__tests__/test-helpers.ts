/**
 * WebSocket Test Helpers
 *
 * Utility functions for WebSocket integration and performance tests
 */

import { WebSocket } from 'ws';
import type { EventMessage, AckMessage, ErrorMessage, PongMessage } from '../protocol.js';

/**
 * Wait for WebSocket connection to open
 */
export function waitForConnection(ws: WebSocket, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeoutMs);

    ws.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Wait for a specific message that matches a predicate
 */
export function waitForMessage<T = any>(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error('Message timeout'));
    }, timeoutMs);

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (predicate(msg)) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (error) {
        // Ignore parse errors, continue waiting
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Wait for a condition to be true
 */
export function waitFor(
  condition: () => boolean,
  timeoutMs = 5000,
  checkIntervalMs = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (condition()) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Condition timeout'));
    }, timeoutMs);

    const interval = setInterval(() => {
      if (condition()) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, checkIntervalMs);
  });
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Collect messages from a WebSocket for a specified duration
 */
export function collectMessages(
  ws: WebSocket,
  durationMs: number
): Promise<any[]> {
  return new Promise((resolve) => {
    const messages: any[] = [];

    const handler = (data: Buffer) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch (error) {
        // Ignore parse errors
      }
    };

    ws.on('message', handler);

    setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(messages);
    }, durationMs);
  });
}

/**
 * Wait for an ack message for a specific subscription
 */
export function waitForAck(
  ws: WebSocket,
  topic?: string,
  timeoutMs = 5000
): Promise<AckMessage> {
  return waitForMessage<AckMessage>(
    ws,
    (msg) => {
      if (msg.type !== 'ack') return false;
      if (topic && msg.subscribed !== topic && msg.unsubscribed !== topic) return false;
      return true;
    },
    timeoutMs
  );
}

/**
 * Wait for an event message
 */
export function waitForEvent(
  ws: WebSocket,
  eventType?: string,
  timeoutMs = 5000
): Promise<EventMessage> {
  return waitForMessage<EventMessage>(
    ws,
    (msg) => {
      if (msg.type !== 'event') return false;
      if (eventType && msg.event !== eventType) return false;
      return true;
    },
    timeoutMs
  );
}

/**
 * Wait for an error message
 */
export function waitForError(
  ws: WebSocket,
  timeoutMs = 5000
): Promise<ErrorMessage> {
  return waitForMessage<ErrorMessage>(
    ws,
    (msg) => msg.type === 'error',
    timeoutMs
  );
}

/**
 * Wait for a pong message
 */
export function waitForPong(
  ws: WebSocket,
  timeoutMs = 5000
): Promise<PongMessage> {
  return waitForMessage<PongMessage>(
    ws,
    (msg) => msg.type === 'pong',
    timeoutMs
  );
}

/**
 * Create a WebSocket client and wait for connection
 */
export async function createClient(
  port: number,
  path = '/api/ws'
): Promise<WebSocket> {
  const client = new WebSocket(`ws://localhost:${port}${path}`);
  await waitForConnection(client);
  return client;
}

/**
 * Subscribe to a topic and wait for ack
 */
export async function subscribe(
  ws: WebSocket,
  topic: string,
  filter?: any
): Promise<void> {
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic,
    filter,
  }));

  await waitForAck(ws, topic);
}

/**
 * Unsubscribe from a topic and wait for ack
 */
export async function unsubscribe(
  ws: WebSocket,
  topic: string
): Promise<void> {
  ws.send(JSON.stringify({
    type: 'unsubscribe',
    topic,
  }));

  await waitForAck(ws, topic);
}

/**
 * Close WebSocket and wait for close event
 */
export function closeClient(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    ws.once('close', () => resolve());
    ws.close();
  });
}

/**
 * Close multiple clients in parallel
 */
export async function closeClients(clients: WebSocket[]): Promise<void> {
  await Promise.all(clients.map(closeClient));
}

/**
 * Create an event collector that filters by predicate
 */
export class EventCollector {
  private events: EventMessage[] = [];
  private handler: ((data: Buffer) => void) | null = null;

  constructor(
    private ws: WebSocket,
    private predicate?: (event: EventMessage) => boolean
  ) {}

  start(): void {
    this.handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'event') {
          if (!this.predicate || this.predicate(msg)) {
            this.events.push(msg);
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    };

    this.ws.on('message', this.handler);
  }

  stop(): void {
    if (this.handler) {
      this.ws.removeListener('message', this.handler);
      this.handler = null;
    }
  }

  getEvents(): EventMessage[] {
    return [...this.events];
  }

  getEventCount(): number {
    return this.events.length;
  }

  waitForCount(count: number, timeoutMs = 5000): Promise<EventMessage[]> {
    return waitFor(() => this.events.length >= count, timeoutMs)
      .then(() => this.getEvents());
  }

  clear(): void {
    this.events = [];
  }
}
