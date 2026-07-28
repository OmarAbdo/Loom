/**
 * UserRepository against a REAL Postgres (Testcontainers).
 *
 * Verifies the behaviors carried over from the Mongoose model:
 *  - create() hashes the password (never stores plaintext) and never returns it
 *  - findByEmailWithPassword returns the hash for signin comparison
 *  - the email UNIQUE constraint is enforced by the real DB
 *  - the DB generates a uuid id
 */
import { startPgHarness, PgHarness } from '../../test/pg-testcontainer';
import { UserRepository } from '../user-repository';
import { Password } from '../../services/password';

jest.setTimeout(60000); // container startup

let harness: PgHarness;
let repo: UserRepository;

beforeAll(async () => {
  harness = await startPgHarness();
  repo = new UserRepository(harness.db);
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(async () => {
  await harness.truncateAll();
});

it('creates a user with a generated uuid id and a hashed password', async () => {
  const user = await repo.create('test@test.com', 'password');

  expect(user.email).toBe('test@test.com');
  expect(user.id).toMatch(/^[0-9a-f-]{36}$/); // uuid
  expect((user as any).password).toBeUndefined(); // never exposed

  const stored = await repo.findByEmailWithPassword('test@test.com');
  expect(stored!.password).not.toBe('password'); // hashed
  expect(stored!.password).toContain('.'); // hash.salt format
  await expect(
    Password.compare(stored!.password, 'password')
  ).resolves.toBe(true);
});

it('enforces the email unique constraint (real DB)', async () => {
  await repo.create('dupe@test.com', 'password');
  await expect(repo.create('dupe@test.com', 'other')).rejects.toThrow();
});

it('existsByEmail reflects presence', async () => {
  expect(await repo.existsByEmail('nobody@test.com')).toBe(false);
  await repo.create('somebody@test.com', 'password');
  expect(await repo.existsByEmail('somebody@test.com')).toBe(true);
});
