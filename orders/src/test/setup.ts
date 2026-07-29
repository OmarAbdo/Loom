import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { connectDb, getDb } from '../db/connection';
import { migrateToLatest } from '../db/migrator';

/**
 * Integration-test setup for orders HTTP routes.
 * Real Postgres (Testcontainers); the base Publisher is mocked to a spy routed
 * through global.kafkaSend (no broker/registry). See tickets service setup.
 */

declare global {
  // eslint-disable-next-line no-var
  var signin: (id?: string) => string[];
  // eslint-disable-next-line no-var
  var kafkaSend: jest.Mock;
}

const kafkaSend = jest.fn().mockResolvedValue(undefined);
global.kafkaSend = kafkaSend;

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
  await getDb().deleteFrom('orders').execute();
  await getDb().deleteFrom('tickets').execute();
});

afterAll(async () => {
  await getDb().destroy();
  await container.stop();
});

/** Cookie for a signed-in user. Pass an id to control ownership across requests. */
global.signin = (id?: string) => {
  const payload = { id: id ?? randomUUID(), email: 'test@test.com' };
  const token = jwt.sign(payload, process.env.JWT_KEY!);
  const base64 = Buffer.from(JSON.stringify({ jwt: token })).toString('base64');
  return [`session=${base64}`];
};
