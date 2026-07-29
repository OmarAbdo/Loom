/**
 * Unit tests for the base Listener's delivery semantics — the subtle,
 * broker-independent logic: manual commit of `offset + 1`, and committing ONLY
 * when the handler acked. We mock the kafka-wrapper so no real broker/registry
 * is involved; we drive the `eachMessage` callback the base class registers.
 */
import { Listener, Message } from '../base-listener';
import { Subjects } from '@omarabdo/ticketing-schemas';

// --- Mock the shared wrapper (Kafka client + registry) --------------------
const commitOffsets = jest.fn().mockResolvedValue(undefined);
const subscribe = jest.fn().mockResolvedValue(undefined);
const connect = jest.fn().mockResolvedValue(undefined);
let capturedRunConfig: any;
const run = jest.fn((config: any) => {
  capturedRunConfig = config;
});

const fakeConsumer = { connect, subscribe, run, commitOffsets, disconnect: jest.fn() };

// AvroDeserializer.deserialize is stubbed to return a fixed object.
jest.mock('@confluentinc/schemaregistry', () => ({
  SerdeType: { VALUE: 0 },
  AvroDeserializer: jest.fn().mockImplementation(() => ({
    deserialize: jest.fn().mockResolvedValue({ hello: 'world' }),
  })),
}));

jest.mock('../kafka-wrapper', () => ({
  kafkaWrapper: {
    kafka: { consumer: () => fakeConsumer },
    registry: {},
  },
}));

// --- A concrete listener whose ack behavior we control per-test -----------
class TestListener extends Listener<{ subject: Subjects.TicketCreated; data: any }> {
  subject: Subjects.TicketCreated = Subjects.TicketCreated;
  groupId = 'test-group';
  public shouldAck = true;
  public received: any[] = [];

  async onMessage(data: any, msg: Message): Promise<void> {
    this.received.push(data);
    if (this.shouldAck) msg.ack();
  }
}

function makePayload(offset: string) {
  return {
    topic: 'ticket.created',
    partition: 2,
    message: { value: Buffer.from('x'), offset, headers: {} },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('subscribes to its subject and registers an eachMessage handler', async () => {
  const listener = new TestListener();
  await listener.listen();

  expect(subscribe).toHaveBeenCalledWith({ topics: [Subjects.TicketCreated] });
  expect(typeof capturedRunConfig.eachMessage).toBe('function');
});

it('commits offset + 1 on the right topic/partition after a successful ack', async () => {
  const listener = new TestListener();
  listener.shouldAck = true;
  await listener.listen();

  await capturedRunConfig.eachMessage(makePayload('41'));

  expect(listener.received).toEqual([{ hello: 'world' }]);
  expect(commitOffsets).toHaveBeenCalledWith([
    { topic: 'ticket.created', partition: 2, offset: '42' },
  ]);
});

it('does NOT commit when the handler never acks', async () => {
  const listener = new TestListener();
  listener.shouldAck = false;
  await listener.listen();

  await capturedRunConfig.eachMessage(makePayload('41'));

  expect(listener.received).toHaveLength(1);
  expect(commitOffsets).not.toHaveBeenCalled();
});

it('propagates handler errors (so the offset is not committed -> redelivery)', async () => {
  class ThrowingListener extends TestListener {
    async onMessage(): Promise<void> {
      throw new Error('boom');
    }
  }
  const listener = new ThrowingListener();
  await listener.listen();

  await expect(capturedRunConfig.eachMessage(makePayload('41'))).rejects.toThrow('boom');
  expect(commitOffsets).not.toHaveBeenCalled();
});
