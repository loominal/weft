/**
 * NATS client connection helper
 */

import { readFile } from 'node:fs/promises';
import { connect, NatsConnection, ConnectionOptions, credsAuthenticator } from 'nats';
import type { CLIConfiguration } from '@loom/shared';

export interface NATSClientOptions {
  url: string;
  name?: string;
  credentials?: string;
}

let cachedConnection: NatsConnection | null = null;

/**
 * Create or get cached NATS connection
 */
export async function getNATSConnection(
  config: CLIConfiguration
): Promise<NatsConnection> {
  if (cachedConnection && !cachedConnection.isClosed()) {
    return cachedConnection;
  }

  const opts: ConnectionOptions = {
    servers: config.natsUrl || 'nats://localhost:4222',
    name: 'loom-shuttle',
    maxReconnectAttempts: 10,
    reconnectTimeWait: 1000,
  };

  // Add credentials support for production NATS clusters
  if (config.natsCredentials) {
    try {
      const credsContent = await readFile(config.natsCredentials);
      opts.authenticator = credsAuthenticator(credsContent);
    } catch (err) {
      throw new Error(
        `Failed to read NATS credentials file: ${config.natsCredentials}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  cachedConnection = await connect(opts);
  return cachedConnection;
}

/**
 * Close the NATS connection
 */
export async function closeNATSConnection(): Promise<void> {
  if (cachedConnection && !cachedConnection.isClosed()) {
    await cachedConnection.drain();
    await cachedConnection.close();
    cachedConnection = null;
  }
}

/**
 * Subject builders for Loom system
 */
export class LoomSubjects {
  constructor(private projectId: string) {}

  // Work submission and management
  workSubmit(): string {
    return `loom.${this.projectId}.work.submit`;
  }

  workStatus(workItemId: string): string {
    return `loom.${this.projectId}.work.status.${workItemId}`;
  }

  workList(): string {
    return `loom.${this.projectId}.work.list`;
  }

  workGet(): string {
    return `loom.${this.projectId}.work.get`;
  }

  workCancel(): string {
    return `loom.${this.projectId}.work.cancel`;
  }

  // Agent management
  agentsList(): string {
    return `loom.${this.projectId}.agents.list`;
  }

  agentDetails(agentGuid: string): string {
    return `loom.${this.projectId}.agents.${agentGuid}`;
  }

  agentShutdown(): string {
    return `loom.${this.projectId}.agents.shutdown`;
  }

  // Targets
  targetsList(): string {
    return `loom.${this.projectId}.targets.list`;
  }

  targetsRegister(): string {
    return `loom.${this.projectId}.targets.register`;
  }

  targetsGet(): string {
    return `loom.${this.projectId}.targets.get`;
  }

  targetsUpdate(): string {
    return `loom.${this.projectId}.targets.update`;
  }

  targetsRemove(): string {
    return `loom.${this.projectId}.targets.remove`;
  }

  targetsTest(): string {
    return `loom.${this.projectId}.targets.test`;
  }

  targetsEnable(): string {
    return `loom.${this.projectId}.targets.enable`;
  }

  targetsDisable(): string {
    return `loom.${this.projectId}.targets.disable`;
  }

  // Spin-up operations
  spinUpTrigger(): string {
    return `loom.${this.projectId}.spinup.trigger`;
  }

  spinUpStatus(): string {
    return `loom.${this.projectId}.spinup.status`;
  }

  spinUpList(): string {
    return `loom.${this.projectId}.spinup.list`;
  }

  // Stats
  stats(): string {
    return `loom.${this.projectId}.stats`;
  }
}

// Keep the old name as an alias for backward compatibility
export { LoomSubjects as CoordinatorSubjects };
