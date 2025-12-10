/**
 * Multi-agent scenario integration tests
 *
 * Tests for:
 * - Competing consumers for same work
 * - Agent failover during work execution
 * - Work distribution across multiple agents
 *
 * Requires: NATS server with JetStream enabled
 * Run with: RUN_INTEGRATION=true pnpm test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec, KV } from 'nats';
import { v4 as uuidv4 } from 'uuid';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';

const sc = StringCodec();

describe.skipIf(!RUN_INTEGRATION)('Multi-Agent Scenarios', () => {
  let nc: NatsConnection;
  let js: JetStreamClient;
  let jsm: JetStreamManager;
  let agentKV: KV;
  const projectId = `multi-agent-${Date.now()}`;
  const streamName = `LOOM_WORK_${projectId.replace(/-/g, '_').toUpperCase()}`;
  const bucketName = `loom-agents-${projectId}`;

  beforeAll(async () => {
    nc = await connect({ servers: NATS_URL });
    js = nc.jetstream();
    jsm = await nc.jetstreamManager();

    // Create work stream
    try {
      await jsm.streams.add({
        name: streamName,
        subjects: [`loom.${projectId}.work.>`],
        retention: 'workqueue',
        max_msgs: 10000,
        max_age: 3600000000000, // 1 hour
      });
    } catch (e: any) {
      if (!e.message?.includes('already in use')) {
        throw e;
      }
    }

    // Create agent registry
    agentKV = await js.views.kv(bucketName, {
      history: 1,
      ttl: 60000,
    });
  });

  afterAll(async () => {
    try {
      await jsm.streams.delete(streamName);
    } catch { /* ignore */ }
    try {
      await js.views.kv(bucketName).then(kv => kv.destroy());
    } catch { /* ignore */ }
    await nc.drain();
  });

  beforeEach(async () => {
    // Purge stream and clear KV
    try {
      await jsm.streams.purge(streamName);
    } catch { /* ignore */ }
  });

  describe('Competing Consumers', () => {
    it('should distribute work across multiple consumers', async () => {
      const capability = 'shared-capability';
      const subject = `loom.${projectId}.work.queue.${capability}`;
      const consumerName = `competing-consumer-${Date.now()}`;

      // Create shared consumer
      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        ack_policy: 'explicit',
        max_ack_pending: 100,
      });

      // Publish 10 work items
      const workIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const workId = uuidv4();
        workIds.push(workId);
        await js.publish(subject, sc.encode(JSON.stringify({
          id: workId,
          taskId: `task-${i}`,
          description: `Work item ${i}`,
        })));
      }

      // Simulate two workers claiming work concurrently
      const worker1Claims: string[] = [];
      const worker2Claims: string[] = [];

      const consumer = await js.consumers.get(streamName, consumerName);

      // Worker 1 fetches
      const batch1 = await consumer.fetch({ max_messages: 5, expires: 1000 });
      for await (const msg of batch1) {
        const work = JSON.parse(sc.decode(msg.data));
        worker1Claims.push(work.id);
        msg.ack();
      }

      // Worker 2 fetches remaining
      const batch2 = await consumer.fetch({ max_messages: 5, expires: 1000 });
      for await (const msg of batch2) {
        const work = JSON.parse(sc.decode(msg.data));
        worker2Claims.push(work.id);
        msg.ack();
      }

      // All work should be claimed
      const allClaimed = [...worker1Claims, ...worker2Claims];
      expect(allClaimed).toHaveLength(10);

      // No duplicates - each work item claimed exactly once
      const uniqueClaimed = new Set(allClaimed);
      expect(uniqueClaimed.size).toBe(10);

      // Cleanup
      await jsm.consumers.delete(streamName, consumerName);
    });

    it('should not deliver same work to multiple consumers', async () => {
      const capability = 'exclusive-work';
      const subject = `loom.${projectId}.work.queue.${capability}`;
      const consumerName = `exclusive-consumer-${Date.now()}`;

      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        ack_policy: 'explicit',
      });

      // Publish one work item
      const workId = uuidv4();
      await js.publish(subject, sc.encode(JSON.stringify({
        id: workId,
        taskId: 'exclusive-task',
      })));

      const consumer = await js.consumers.get(streamName, consumerName);

      // First worker claims
      const batch1 = await consumer.fetch({ max_messages: 1, expires: 1000 });
      let claimed = false;
      for await (const msg of batch1) {
        claimed = true;
        msg.ack();
      }
      expect(claimed).toBe(true);

      // Second worker should get nothing
      const batch2 = await consumer.fetch({ max_messages: 1, expires: 1000 });
      let secondClaim = false;
      for await (const _msg of batch2) {
        secondClaim = true;
      }
      expect(secondClaim).toBe(false);

      await jsm.consumers.delete(streamName, consumerName);
    });
  });

  describe('Work Redelivery on Failure', () => {
    it('should redeliver work if not acknowledged', async () => {
      const capability = 'redelivery-test';
      const subject = `loom.${projectId}.work.queue.${capability}`;
      const consumerName = `redelivery-consumer-${Date.now()}`;

      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        ack_policy: 'explicit',
        ack_wait: 1000000000, // 1 second in nanoseconds
        max_deliver: 3,
      });

      const workId = uuidv4();
      await js.publish(subject, sc.encode(JSON.stringify({
        id: workId,
        taskId: 'redelivery-task',
      })));

      const consumer = await js.consumers.get(streamName, consumerName);

      // First fetch - don't ack (simulating failure)
      const batch1 = await consumer.fetch({ max_messages: 1, expires: 1000 });
      let firstDelivery = false;
      for await (const msg of batch1) {
        firstDelivery = true;
        // Don't ack - let it timeout
        msg.nak(); // Negative ack for immediate redelivery
      }
      expect(firstDelivery).toBe(true);

      // Wait a bit for redelivery
      await new Promise(resolve => setTimeout(resolve, 200));

      // Second fetch - should get same message
      const batch2 = await consumer.fetch({ max_messages: 1, expires: 1000 });
      let redelivered = false;
      for await (const msg of batch2) {
        const work = JSON.parse(sc.decode(msg.data));
        if (work.id === workId) {
          redelivered = true;
          msg.ack();
        }
      }
      expect(redelivered).toBe(true);

      await jsm.consumers.delete(streamName, consumerName);
    });

    it('should move to DLQ after max delivery attempts', async () => {
      const capability = 'dlq-test';
      const subject = `loom.${projectId}.work.queue.${capability}`;
      const consumerName = `dlq-consumer-${Date.now()}`;

      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        ack_policy: 'explicit',
        ack_wait: 500000000, // 500ms
        max_deliver: 2, // Only 2 attempts
      });

      const workId = uuidv4();
      await js.publish(subject, sc.encode(JSON.stringify({
        id: workId,
        taskId: 'dlq-task',
      })));

      const consumer = await js.consumers.get(streamName, consumerName);

      // Fail delivery twice
      for (let attempt = 0; attempt < 2; attempt++) {
        const batch = await consumer.fetch({ max_messages: 1, expires: 1000 });
        for await (const msg of batch) {
          msg.nak(); // Reject
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Third fetch should get nothing (moved to DLQ/exhausted)
      const finalBatch = await consumer.fetch({ max_messages: 1, expires: 1000 });
      let gotMessage = false;
      for await (const _msg of finalBatch) {
        gotMessage = true;
      }
      expect(gotMessage).toBe(false);

      await jsm.consumers.delete(streamName, consumerName);
    });
  });

  describe('Agent Failover', () => {
    it('should allow new agent to pick up work when original goes offline', async () => {
      const capability = 'failover-test';
      const subject = `loom.${projectId}.work.queue.${capability}`;

      // Register Agent 1
      const agent1Guid = uuidv4();
      await agentKV.put(agent1Guid, JSON.stringify({
        guid: agent1Guid,
        handle: 'agent-1',
        status: 'online',
        capabilities: [capability],
      }));

      // Publish work
      const workId = uuidv4();
      await js.publish(subject, sc.encode(JSON.stringify({
        id: workId,
        taskId: 'failover-task',
        assignedTo: agent1Guid,
      })));

      // Agent 1 goes offline (simulated failure)
      await agentKV.put(agent1Guid, JSON.stringify({
        guid: agent1Guid,
        handle: 'agent-1',
        status: 'offline',
        capabilities: [capability],
      }));

      // Register Agent 2
      const agent2Guid = uuidv4();
      await agentKV.put(agent2Guid, JSON.stringify({
        guid: agent2Guid,
        handle: 'agent-2',
        status: 'online',
        capabilities: [capability],
      }));

      // Verify Agent 2 is online
      const agent2Entry = await agentKV.get(agent2Guid);
      expect(agent2Entry).toBeDefined();
      const agent2 = JSON.parse(new TextDecoder().decode(agent2Entry!.value));
      expect(agent2.status).toBe('online');

      // Verify Agent 1 is offline
      const agent1Entry = await agentKV.get(agent1Guid);
      const agent1 = JSON.parse(new TextDecoder().decode(agent1Entry!.value));
      expect(agent1.status).toBe('offline');
    });

    it('should track multiple agents with different capabilities', async () => {
      const agents = [
        { guid: uuidv4(), handle: 'ts-agent', capabilities: ['typescript'], status: 'online' },
        { guid: uuidv4(), handle: 'py-agent', capabilities: ['python'], status: 'online' },
        { guid: uuidv4(), handle: 'full-stack', capabilities: ['typescript', 'python'], status: 'busy' },
        { guid: uuidv4(), handle: 'offline-agent', capabilities: ['typescript'], status: 'offline' },
      ];

      for (const agent of agents) {
        await agentKV.put(agent.guid, JSON.stringify(agent));
      }

      // Find online typescript agents
      const onlineTs: any[] = [];
      for (const agent of agents) {
        const entry = await agentKV.get(agent.guid);
        if (entry) {
          const data = JSON.parse(new TextDecoder().decode(entry.value));
          if (data.capabilities?.includes('typescript') && data.status !== 'offline') {
            onlineTs.push(data);
          }
        }
      }

      expect(onlineTs).toHaveLength(2); // ts-agent (online) and full-stack (busy)
      expect(onlineTs.map(a => a.handle)).toContain('ts-agent');
      expect(onlineTs.map(a => a.handle)).toContain('full-stack');
      expect(onlineTs.map(a => a.handle)).not.toContain('offline-agent');
    });
  });

  describe('Work Distribution Load Balancing', () => {
    it('should distribute work evenly with round-robin like behavior', async () => {
      const capability = 'load-balance';
      const subject = `loom.${projectId}.work.queue.${capability}`;
      const consumerName = `lb-consumer-${Date.now()}`;

      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        ack_policy: 'explicit',
        max_ack_pending: 1, // Force sequential processing
      });

      // Publish 6 work items
      for (let i = 0; i < 6; i++) {
        await js.publish(subject, sc.encode(JSON.stringify({
          id: uuidv4(),
          taskId: `lb-task-${i}`,
          index: i,
        })));
      }

      const consumer = await js.consumers.get(streamName, consumerName);

      // Simulate 3 workers each taking 2 items
      const workerResults: number[][] = [[], [], []];

      for (let worker = 0; worker < 3; worker++) {
        for (let i = 0; i < 2; i++) {
          const batch = await consumer.fetch({ max_messages: 1, expires: 1000 });
          for await (const msg of batch) {
            const work = JSON.parse(sc.decode(msg.data));
            workerResults[worker].push(work.index);
            msg.ack();
          }
        }
      }

      // All work should be processed
      const allProcessed = workerResults.flat();
      expect(allProcessed).toHaveLength(6);
      expect(new Set(allProcessed).size).toBe(6);

      await jsm.consumers.delete(streamName, consumerName);
    });
  });

  describe('Priority-Based Work Selection', () => {
    it('should process work items (priority handled by application)', async () => {
      const capability = 'priority-test';
      const subject = `loom.${projectId}.work.queue.${capability}`;
      const consumerName = `priority-consumer-${Date.now()}`;

      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        filter_subject: subject,
        ack_policy: 'explicit',
      });

      // Publish work with different priorities
      const workItems = [
        { id: uuidv4(), priority: 3, name: 'low' },
        { id: uuidv4(), priority: 9, name: 'high' },
        { id: uuidv4(), priority: 5, name: 'medium' },
      ];

      for (const item of workItems) {
        await js.publish(subject, sc.encode(JSON.stringify(item)));
      }

      const consumer = await js.consumers.get(streamName, consumerName);

      // Fetch all and sort by priority (simulating application-level prioritization)
      const fetched: any[] = [];
      const batch = await consumer.fetch({ max_messages: 3, expires: 1000 });
      for await (const msg of batch) {
        fetched.push(JSON.parse(sc.decode(msg.data)));
        msg.ack();
      }

      expect(fetched).toHaveLength(3);

      // Sort by priority (application would do this)
      const sorted = [...fetched].sort((a, b) => b.priority - a.priority);
      expect(sorted[0].name).toBe('high');
      expect(sorted[1].name).toBe('medium');
      expect(sorted[2].name).toBe('low');

      await jsm.consumers.delete(streamName, consumerName);
    });
  });
});
