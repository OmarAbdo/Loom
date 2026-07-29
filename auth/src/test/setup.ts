import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { connectDb, getDb } from '../db/connection';
import { migrateToLatest } from '../db/migrator';

/**
 * Integration-test setup for the auth HTTP routes.
 *
 * Boots a REAL Postgres (Testcontainers), wires the shared connectDb singleton
 * to it, and migrates. Auth publishes no events, so there is no Kafka to mock.
 * `global.signin` here performs a real signup+signin against the app to obtain a
 * cookie (auth is the service that issues cookies, so it can't fake one).
 */

declare global {
  // eslint-disable-next-line no-var
  var signin: () => Promise<string[]>;
}

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
  await getDb().deleteFrom('users').execute();
});

afterAll(async () => {
  await getDb().destroy();
  await container.stop();
});

// Real signup -> returns the Set-Cookie header (auth issues the cookie itself).
global.signin = async () => {
  const request = require('supertest');
  const { app } = require('../app');
  const email = `test-${Math.random().toString(36).slice(2)}@test.com`;

  const response = await request(app)
    .post('/api/users/signup')
    .send({ email, password: 'password' })
    .expect(201);

  return response.get('Set-Cookie');
};
