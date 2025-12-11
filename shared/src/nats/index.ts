// NATS client utilities
export {
  createNATSClient,
  parseNatsUrl,
  encodeMessage,
  decodeMessage,
  type ConnectedClient,
  type ParsedNatsUrl,
} from './client.js';

// Subject patterns
export {
  buildSubject,
  WorkSubjects,
  AgentSubjects,
  CoordinatorSubjects,
  TargetSubjects,
  StreamNames,
  KVBuckets,
} from './subjects.js';
