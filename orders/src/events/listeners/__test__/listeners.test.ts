/**
 * Listener tests for orders: ticket replica maintenance + the saga's
 * expiration/payment handlers, including the "don't cancel a paid order" rule.
 * Runs under the default jest config (Testcontainers Postgres + Publisher mock).
 */
import { randomUUID } from 'crypto';
import { getDb } from '../../../db/connection';
import { TicketRepository } from '../../../repositories/ticket-repository';
import { OrderRepository } from '../../../repositories/order-repository';
import { TicketCreatedListener } from '../ticket-created-listener';
import { TicketUpdatedListener } from '../ticket-updated-listener';
import { ExpirationCompleteListener } from '../expiration-complete-listener';
import { PaymentCreatedListener } from '../payment-created-listener';
import type { Message } from '@omarabdo/ticketing-common';

function fakeMsg() {
  let acked = false;
  return { msg: { ack: () => { acked = true; }, raw: {} as any } as Message, acked: () => acked };
}

const tickets = () => new TicketRepository(getDb());
const orders = () => new OrderRepository(getDb());

async function seedReplicaTicket() {
  const id = randomUUID();
  return tickets().create({ id, title: 'concert', price: 20, version: 0 });
}
async function seedOrder(ticketId: string, status: 'created' | 'complete' = 'created') {
  return orders().create({
    userId: randomUUID(),
    status,
    expiresAt: new Date(Date.now() + 60000),
    ticketId,
  });
}

describe('ticket replica listeners', () => {
  it('TicketCreated inserts the replica and acks', async () => {
    const id = randomUUID();
    const { msg, acked } = fakeMsg();
    await new TicketCreatedListener().onMessage(
      { id, version: 0, title: 'concert', price: 25, userId: randomUUID() },
      msg
    );
    expect(await tickets().findById(id)).toMatchObject({ id, price: 25, version: 0 });
    expect(acked()).toBe(true);
  });

  it('TicketUpdated advances the replica on the successor version', async () => {
    const t = await seedReplicaTicket(); // v0
    const { msg, acked } = fakeMsg();
    await new TicketUpdatedListener().onMessage(
      { id: t.id, version: 1, title: 'new', price: 40, userId: randomUUID() },
      msg
    );
    expect(await tickets().findById(t.id)).toMatchObject({ version: 1, price: 40 });
    expect(acked()).toBe(true);
  });

  it('TicketUpdated throws (no ack) on an out-of-order event', async () => {
    const t = await seedReplicaTicket(); // v0
    const { msg, acked } = fakeMsg();
    await expect(
      new TicketUpdatedListener().onMessage(
        { id: t.id, version: 5, title: 'x', price: 1, userId: randomUUID() },
        msg
      )
    ).rejects.toThrow();
    expect(acked()).toBe(false);
  });
});

describe('saga listeners', () => {
  it('PaymentCreated marks the order complete', async () => {
    const t = await seedReplicaTicket();
    const o = await seedOrder(t.id);
    const { msg, acked } = fakeMsg();
    await new PaymentCreatedListener().onMessage(
      { id: randomUUID(), orderId: o.id, stripeId: 'ch_1' },
      msg
    );
    expect(await orders().findById(o.id)).toMatchObject({ status: 'complete' });
    expect(acked()).toBe(true);
  });

  it('ExpirationComplete cancels an unpaid order and publishes order.cancelled', async () => {
    const t = await seedReplicaTicket();
    const o = await seedOrder(t.id, 'created');
    const { msg, acked } = fakeMsg();
    await new ExpirationCompleteListener().onMessage({ orderId: o.id }, msg);
    expect(await orders().findById(o.id)).toMatchObject({ status: 'cancelled' });
    expect(global.kafkaSend).toHaveBeenCalled();
    expect(acked()).toBe(true);
  });

  it('ExpirationComplete does NOT cancel a completed order (don\'t-cancel-paid rule)', async () => {
    const t = await seedReplicaTicket();
    const o = await seedOrder(t.id, 'complete'); // already paid
    const { msg, acked } = fakeMsg();
    await new ExpirationCompleteListener().onMessage({ orderId: o.id }, msg);
    // Still complete, and NO order.cancelled published.
    expect(await orders().findById(o.id)).toMatchObject({ status: 'complete' });
    expect(global.kafkaSend).not.toHaveBeenCalled();
    expect(acked()).toBe(true);
  });
});
