/**
 * Payments data layer against a REAL Postgres (Testcontainers).
 *
 * Covers the order replica (create with producer id+version, findByEvent,
 * guarded status update) and the payments table (create, FK to orders).
 */
import { randomUUID } from 'crypto';
import { startPgHarness, PgHarness } from '../../test/pg-testcontainer';
import { OrderRepository } from '../order-repository';
import { PaymentRepository } from '../payment-repository';

jest.setTimeout(60000);

let harness: PgHarness;
let ordersRepo: OrderRepository;
let paymentsRepo: PaymentRepository;

beforeAll(async () => {
  harness = await startPgHarness();
  ordersRepo = new OrderRepository(harness.db);
  paymentsRepo = new PaymentRepository(harness.db);
});
afterAll(async () => {
  await harness.stop();
});
beforeEach(async () => {
  await harness.truncateAll();
});

async function seedOrder(status: 'created' | 'awaiting:payment' = 'awaiting:payment') {
  return ordersRepo.create({
    id: randomUUID(),
    userId: randomUUID(),
    price: 20,
    status,
    version: 0,
  });
}

describe('order replica', () => {
  it('creates a replica keyed by producer id + version', async () => {
    const o = await seedOrder();
    expect(await ordersRepo.findById(o.id)).toMatchObject({ id: o.id, version: 0 });
  });

  it('findByEvent returns the row at version-1', async () => {
    const o = await seedOrder();
    expect(await ordersRepo.findByEvent({ id: o.id, version: 1 })).toMatchObject({ id: o.id });
    expect(await ordersRepo.findByEvent({ id: o.id, version: 4 })).toBeUndefined();
  });

  it('updateStatus advances the replica (guarded)', async () => {
    const o = await seedOrder();
    const cancelled = await ordersRepo.updateStatus(o.id, 0, 'cancelled', 1);
    expect(cancelled).toMatchObject({ status: 'cancelled', version: 1 });
    // stale update returns undefined
    expect(await ordersRepo.updateStatus(o.id, 0, 'complete', 1)).toBeUndefined();
  });
});

describe('payments', () => {
  it('creates a payment for an existing order with a generated uuid', async () => {
    const o = await seedOrder();
    const p = await paymentsRepo.create({ orderId: o.id, stripeId: 'ch_test_123' });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.orderId).toBe(o.id);
    expect(await paymentsRepo.findById(p.id)).toMatchObject({ stripeId: 'ch_test_123' });
  });

  it('enforces the order_id foreign key (real DB)', async () => {
    await expect(
      paymentsRepo.create({ orderId: randomUUID(), stripeId: 'ch_x' })
    ).rejects.toThrow();
  });
});
