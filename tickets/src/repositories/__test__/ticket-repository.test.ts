/**
 * TicketRepository against a REAL Postgres (Testcontainers).
 *
 * The important tests here are the OPTIMISTIC CONCURRENCY ones — the mechanism
 * the whole event system's consistency depends on
 * (docs/concepts/optimistic-concurrency.md). We prove:
 *   - create() starts at version 0
 *   - a version-guarded update advances the version
 *   - a stale update (wrong expected version) is rejected as a conflict
 *   - findByEvent returns the row at version-1 (and nothing when out of order)
 */
import { randomUUID } from 'crypto';
import { startPgHarness, PgHarness } from '../../test/pg-testcontainer';
import { TicketRepository, ConcurrencyError } from '../ticket-repository';

jest.setTimeout(60000);

// user_id and order_id are uuid columns (they hold ids minted by other
// services), so tests must use real uuids, not placeholder strings.
const USER = randomUUID();
const ORDER = randomUUID();

let harness: PgHarness;
let repo: TicketRepository;

beforeAll(async () => {
  harness = await startPgHarness();
  repo = new TicketRepository(harness.db);
});
afterAll(async () => {
  await harness.stop();
});
beforeEach(async () => {
  await harness.truncateAll();
});

it('creates a ticket at version 0 with a generated uuid', async () => {
  const t = await repo.create({ title: 'concert', price: 20, userId: USER });
  expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(t.version).toBe(0);
  expect(t.orderId).toBeNull();
});

it('advances version on a guarded update', async () => {
  const t = await repo.create({ title: 'concert', price: 20, userId: USER });
  const updated = await repo.update(t.id, t.version, { price: 99 });
  expect(updated.version).toBe(1);
  expect(updated.price).toBe(99);
});

it('rejects a stale update (version mismatch) as a ConcurrencyError', async () => {
  const t = await repo.create({ title: 'concert', price: 20, userId: USER });
  // First update succeeds: version 0 -> 1.
  await repo.update(t.id, 0, { price: 30 });
  // Second update using the now-stale version 0 must be rejected.
  await expect(repo.update(t.id, 0, { price: 40 })).rejects.toBeInstanceOf(
    ConcurrencyError
  );
});

it('simulates two concurrent writers: exactly one wins', async () => {
  const t = await repo.create({ title: 'concert', price: 20, userId: USER });
  // Both read version 0, then both try to update from 0.
  const results = await Promise.allSettled([
    repo.update(t.id, 0, { price: 100 }),
    repo.update(t.id, 0, { price: 200 }),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
});

it('reserve/release via orderId round-trips', async () => {
  const t = await repo.create({ title: 'concert', price: 20, userId: USER });
  const reserved = await repo.update(t.id, t.version, { orderId: ORDER });
  expect(reserved.orderId).toBe(ORDER);
  const released = await repo.update(reserved.id, reserved.version, { orderId: null });
  expect(released.orderId).toBeNull();
});

it('findByEvent returns the row at version-1, else undefined', async () => {
  const t = await repo.create({ title: 'concert', price: 20, userId: USER }); // version 0
  // An event with version 1 targets the row currently at version 0.
  expect(await repo.findByEvent({ id: t.id, version: 1 })).toMatchObject({ id: t.id });
  // An event with version 3 (out of order) finds nothing at version 2.
  expect(await repo.findByEvent({ id: t.id, version: 3 })).toBeUndefined();
});
