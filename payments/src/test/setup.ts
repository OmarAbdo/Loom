import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { connectDb, getDb } from '../db/connection';
import { migrateToLatest } from '../db/migrator';

/**
 * Integration-test setup for payments HTTP routes.
 * Real Postgres (Testcontainers); base Publisher mocked to a spy; the stripe
 * module is auto-mocked via jest.mock('../stripe') in the test file.
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
  // Non-Stripe-shaped placeholder: the stripe module is mocked in these tests,
  // so the value only needs to be defined. (Avoids GitHub secret-scanning false
  // positives on the sk_test_ prefix.)
  process.env.STRIPE_KEY = 'dummy-stripe-key';
  process.env.NODE_ENV = 'test';
  container = await new PostgreSqlContainer('postgres:16').start();
  const db = connectDb(container.getConnectionUri());
  await migrateToLatest(db);
});

beforeEach(async () => {
  jest.clearAllMocks();
  await getDb().deleteFrom('payments').execute();
  await getDb().deleteFrom('orders').execute();
});

afterAll(async () => {
  await getDb().destroy();
  await container.stop();
});

global.signin = (id?: string) => {
  const payload = { id: id ?? randomUUID(), email: 'test@test.com' };
  const token = jwt.sign(payload, process.env.JWT_KEY!);
  const base64 = Buffer.from(JSON.stringify({ jwt: token })).toString('base64');
  return [`session=${base64}`];
};
