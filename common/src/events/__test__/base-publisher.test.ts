/**
 * Unit tests for the base Publisher: it serializes via Avro, produces to the
 * topic named by `subject`, and applies the partition key returned by `key()`
 * (the per-entity ordering mechanism). kafka-wrapper + serializer are mocked.
 */
import { Publisher } from '../base-publisher';
import { Subjects } from '@omarabdo/ticketing-schemas';

const send = jest.fn().mockResolvedValue(undefined);
const serialize = jest.fn().mockResolvedValue(Buffer.from('avro-bytes'));

jest.mock('@confluentinc/schemaregistry', () => ({
  SerdeType: { VALUE: 0 },
  AvroSerializer: jest.fn().mockImplementation(() => ({ serialize })),
}));

jest.mock('../kafka-wrapper', () => ({
  kafkaWrapper: {
    registry: {},
    producer: { send: (...args: any[]) => send(...args) },
  },
}));

type TicketCreated = {
  subject: Subjects.TicketCreated;
  data: { id: string; title: string };
};

class KeyedPublisher extends Publisher<TicketCreated> {
  subject: Subjects.TicketCreated = Subjects.TicketCreated;
  protected key(data: TicketCreated['data']) {
    return data.id; // per-entity ordering on ticket id
  }
}

class UnkeyedPublisher extends Publisher<TicketCreated> {
  subject: Subjects.TicketCreated = Subjects.TicketCreated;
}

beforeEach(() => jest.clearAllMocks());

it('serializes the data against the subject and sends to that topic', async () => {
  await new KeyedPublisher().publish({ id: 't1', title: 'concert' });

  expect(serialize).toHaveBeenCalledWith('ticket:created', { id: 't1', title: 'concert' });
  const sendArg = send.mock.calls[0][0];
  expect(sendArg.topic).toBe('ticket:created');
  expect(sendArg.messages[0].value).toEqual(Buffer.from('avro-bytes'));
});

it('sets the partition key from key() when provided', async () => {
  await new KeyedPublisher().publish({ id: 't1', title: 'concert' });
  expect(send.mock.calls[0][0].messages[0].key).toBe('t1');
});

it('omits the key when key() returns undefined', async () => {
  await new UnkeyedPublisher().publish({ id: 't1', title: 'concert' });
  expect(send.mock.calls[0][0].messages[0]).not.toHaveProperty('key');
});
