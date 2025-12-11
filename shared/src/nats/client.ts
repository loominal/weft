import { connect, NatsConnection, JetStreamClient, JetStreamManager, ConnectionOptions } from 'nats';
import type { NATSConfiguration } from '../types/config.js';

/**
 * Connected NATS client with JetStream
 */
export interface ConnectedClient {
  /** Raw NATS connection */
  nc: NatsConnection;

  /** JetStream client for publishing/consuming */
  js: JetStreamClient;

  /** JetStream manager for admin operations */
  jsm: JetStreamManager;

  /** Close the connection */
  close: () => Promise<void>;
}

/**
 * Parsed NATS URL components
 */
export interface ParsedNatsUrl {
  /** Server URL without credentials (e.g., "nats://host:4222") */
  server: string;
  /** Username if present in URL */
  user?: string;
  /** Password if present in URL */
  pass?: string;
}

/**
 * Parse a NATS URL that may contain credentials
 *
 * Supports formats:
 * - nats://host:port (no auth)
 * - nats://user:pass@host:port (with auth)
 * - nats://user@host:port (user only, password from env)
 *
 * @param url - NATS URL to parse
 * @returns Parsed components with server URL and optional credentials
 */
export function parseNatsUrl(url: string): ParsedNatsUrl {
  try {
    // Handle nats:// protocol by temporarily replacing with http://
    // since URL class doesn't recognize nats://
    const normalizedUrl = url.replace(/^nats:\/\//, 'http://');
    const parsed = new URL(normalizedUrl);

    // Reconstruct the server URL without credentials
    const server = `nats://${parsed.host}`;

    const result: ParsedNatsUrl = { server };

    // Extract credentials if present
    if (parsed.username) {
      result.user = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      result.pass = decodeURIComponent(parsed.password);
    }

    return result;
  } catch {
    // If URL parsing fails, return as-is (e.g., for simple "localhost:4222")
    return { server: url };
  }
}

/**
 * Create a NATS connection with JetStream enabled
 *
 * Supports authentication via:
 * 1. Credentials in URL: nats://user:pass@host:port
 * 2. Environment variables: NATS_USER and NATS_PASS (fallback)
 * 3. Credentials file: config.credentials path
 *
 * Authentication is optional - if no credentials are provided,
 * connects without authentication (suitable for local development).
 */
export async function createNATSClient(config: NATSConfiguration): Promise<ConnectedClient> {
  // Parse URL and extract credentials if present
  const parsed = parseNatsUrl(config.url);

  // Resolve credentials: URL > env vars > credentials file
  const urlUser = parsed.user ?? process.env['NATS_USER'];
  const urlPass = parsed.pass ?? process.env['NATS_PASS'];

  const connectOpts: ConnectionOptions = {
    servers: parsed.server,
    name: config.name ?? 'loom-client',
    reconnect: true,
    maxReconnectAttempts: config.reconnect?.maxAttempts ?? 10,
    reconnectTimeWait: config.reconnect?.delayMs ?? 1000,
  };

  // Add user/pass auth if available (takes precedence over creds file)
  if (urlUser) {
    connectOpts.user = urlUser;
    if (urlPass) {
      connectOpts.pass = urlPass;
    }
  } else if (config.credentials) {
    // Fall back to credentials file if no URL/env auth
    connectOpts.credsFile = config.credentials;
  }

  const nc = await connect(connectOpts);

  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  return {
    nc,
    js,
    jsm,
    close: async () => {
      await nc.drain();
      await nc.close();
    },
  };
}

/**
 * Encode data for NATS message
 */
export function encodeMessage<T>(data: T): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

/**
 * Decode NATS message data
 */
export function decodeMessage<T>(data: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(data)) as T;
}
