/**
 * Orders data layer against a REAL Postgres (Testcontainers).
 *
 * Covers the two repos and the behaviors carried over from the Mongoose models:
 *  - ticket replica: create with producer id, findByEvent (version-1), isReserved
 *  - order: OCC status transitions, findByUser
 *  - the FK from orders.ticket_id -> tickets.id
 */
import { randomUUID } from 'crypto';
import { startPgHarness, PgHarness } from '../../test/pg-testcontainer';
import { TicketRepository } from '../ticket-repository';
import { OrderRepository, ConcurrencyError } from '../order-repository';

jest.setTimeout(60000);

let harness: PgHarness;
let tickets: TicketRepository;
let orders: OrderRepository;

const USER = randomUUID();

beforeAll(async () => {
  harness = await startPgHarness();
  tickets = new TicketRepository(harness.db);
  orders = new OrderRepository(harness.db);
});
afterAll(async () => {
  await harness.stop();
});
beforeEach(async () => {
  await harness.truncateAll();
});

async function seedTicket() {
  const id = randomUUID();
  return tickets.create({ id, title: 'concert', price: 20, version: 0 });
}

describe('ticket replica', () => {
  it('creates a replica row keyed by the producer id', async () => {
    const id = randomUUID();
    const t = await tickets.create({ id, title: 'concert', price: 20, version: 0 });
    expect(t.id).toBe(id);
    expect(await tickets.findById(id)).toMatchObject({ id, version: 0 });
  });

  it('findByEvent returns the row at version-1', async () => {
    const t = await seedTicket(); // version 0
    expect(await tickets.findByEvent({ id: t.id, version: 1 })).toMatchObject({ id: t.id });
    expect(await tickets.findByEvent({ id: t.id, version: 5 })).toBeUndefined();
  });

  it('updateFromEvent advances the replica version (guarded)', async () => {
    const t = await seedTicket();
    const updated = await tickets.updateFromEvent(t.id, 0, { title: 'x', price: 30, version: 1 });
    expect(updated).toMatchObject({ version: 1, price: 30 });
    // stale update returns undefined (no row at version 0 anymore)
    expect(await tickets.updateFromEvent(t.id, 0, { title: 'y', price: 40, version: 1 })).toBeUndefined();
  });
});

describe('order + isReserved', () => {
  it('isReserved is false with no order, true once an active order exists', async () => {
    const t = await seedTicket();
    expect(await tickets.isReserved(t.id)).toBe(false);

    await orders.create({
      userId: USER,
      status: 'created',
      expiresAt: new Date(Date.now() + 60000),
      ticketId: t.id,
    });
    expect(await tickets.isReserved(t.id)).toBe(true);
  });

  it('isReserved is false when the only order is cancelled', async () => {
    const t = await seedTicket();
    const o = await orders.create({
      userId: USER,
      status: 'created',
      expiresAt: new Date(Date.now() + 60000),
      ticketId: t.id,
    });
    await orders.updateStatus(o.id, o.version, 'cancelled');
    expect(await tickets.isReserved(t.id)).toBe(false);
  });

  it('updateStatus advances version and rejects a stale write', async () => {
    const t = await seedTicket();
    const o = await orders.create({
      userId: USER,
      status: 'created',
      expiresAt: new Date(Date.now() + 60000),
      ticketId: t.id,
    });
    const paid = await orders.updateStatus(o.id, o.version, 'complete');
    expect(paid.version).toBe(o.version + 1);
    await expect(orders.updateStatus(o.id, o.version, 'cancelled')).rejects.toBeInstanceOf(
      ConcurrencyError
    );
  });

  it('enforces the ticket_id foreign key (real DB)', async () => {
    await expect(
      orders.create({
        userId: USER,
        status: 'created',
        expiresAt: new Date(),
        ticketId: randomUUID(), // no such ticket
      })
    ).rejects.toThrow();
  });

  it('findByUser returns only that user\'s orders', async () => {
    const t1 = await seedTicket();
    const t2 = await seedTicket();
    await orders.create({ userId: USER, status: 'created', expiresAt: new Date(Date.now() + 60000), ticketId: t1.id });
    await orders.create({ userId: randomUUID(), status: 'created', expiresAt: new Date(Date.now() + 60000), ticketId: t2.id });
    const mine = await orders.findByUser(USER);
    expect(mine).toHaveLength(1);
  });
});
