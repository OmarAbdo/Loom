import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { connectDb, getDb } from '../db/connection';
import { migrateToLatest } from '../db/migrator';

/**
 * Integration-test setup for the tickets HTTP routes.
 *
 * - Boots a REAL Postgres (Testcontainers) and wires the shared `connectDb`
 *   singleton to it, then migrates.
 * - Mocks the Avro serializer and the kafkaWrapper producer so publishing does
 *   not need a real broker/registry. Tests assert publication via
 *   `global.kafkaSend` (the mocked producer.send spy).
 */

declare global {
  // eslint-disable-next-line no-var
  var signin: () => string[];
  // eslint-disable-next-line no-var
  var kafkaSend: jest.Mock;
}

const kafkaSend = jest.fn().mockResolvedValue(undefined);
global.kafkaSend = kafkaSend;

// Mock the common package: stub kafkaWrapper (no real broker) and make the base
// Publisher.publish a spy routed through global.kafkaSend, so publishing needs
// no Avro serializer / Schema Registry. The Listener base class is left real but
// unused in route tests. This avoids resolving @confluentinc/* transitive deps.
jest.mock('@omarabdo/ticketing-common', () => {
  const actual = jest.requireActual('@omarabdo/ticketing-common');
  return {
    ...actual,
    kafkaWrapper: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      producer: { send: jest.fn() },
      registry: {},
      kafka: {},
    },
    Publisher: class {
      async publish(data: unknown) {
        return (global as any).kafkaSend(data);
      }
    },
  };
});

let container: StartedPostgreSqlContainer;

jest.setTimeout(60000);

beforeAll(async () => {
  process.env.JWT_KEY = 'test-jwt-key';
  process.env.NODE_ENV = 'test';

  container = await new PostgreSqlContainer('postgres:16').start();
  const db = connectDb(container.getConnectionUri());
  await migrateToLatest(db);
});

beforeEach(async () => {
  jest.clearAllMocks();
  await getDb().deleteFrom('tickets').execute();
});

afterAll(async () => {
  await getDb().destroy();
  await container.stop();
});

/** Build a signed-in cookie (a JWT for a random user) for authenticated routes. */
global.signin = () => {
  const payload = { id: randomUUID(), email: 'test@test.com' };
  const token = jwt.sign(payload, process.env.JWT_KEY!);
  const base64 = Buffer.from(JSON.stringify({ jwt: token })).toString('base64');
  return [`session=${base64}`];
};
