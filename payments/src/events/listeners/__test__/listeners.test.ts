/**
 * Listener tests for payments: the local order replica (insert on order.created,
 * cancel on order.cancelled). Runs under the default jest config (Testcontainers
 * Postgres + Publisher mock).
 */
import { randomUUID } from 'crypto';
import { getDb } from '../../../db/connection';
import { OrderRepository } from '../../../repositories/order-repository';
import { OrderCreatedListener } from '../order-created-listener';
import { OrderCancelledListener } from '../order-cancelled-listener';
import type { Message } from '@omarabdo/ticketing-common';

function fakeMsg() {
  let acked = false;
  return { msg: { ack: () => { acked = true; }, raw: {} as any } as Message, acked: () => acked };
}
const orders = () => new OrderRepository(getDb());

describe('OrderCreatedListener (payments)', () => {
  it('replicates the order and acks', async () => {
    const id = randomUUID();
    const { msg, acked } = fakeMsg();
    await new OrderCreatedListener().onMessage(
      {
        id, version: 0, status: 'created' as any, userId: randomUUID(),
        expiresAt: new Date().toISOString(), ticket: { id: randomUUID(), price: 30 },
      },
      msg
    );
    expect(await orders().findById(id)).toMatchObject({ id, price: 30, status: 'created' });
    expect(acked()).toBe(true);
  });
});

describe('OrderCancelledListener (payments)', () => {
  it('cancels the replicated order via findByEvent and acks', async () => {
    const id = randomUUID();
    await orders().create({ id, userId: randomUUID(), price: 30, status: 'created', version: 0 });

    const { msg, acked } = fakeMsg();
    await new OrderCancelledListener().onMessage(
      { id, version: 1, ticket: { id: randomUUID() } },
      msg
    );
    expect(await orders().findById(id)).toMatchObject({ status: 'cancelled', version: 1 });
    expect(acked()).toBe(true);
  });

  it('throws (no ack) when the predecessor version is missing (out of order)', async () => {
    const id = randomUUID();
    await orders().create({ id, userId: randomUUID(), price: 30, status: 'created', version: 0 });
    const { msg, acked } = fakeMsg();
    await expect(
      new OrderCancelledListener().onMessage({ id, version: 5, ticket: { id: randomUUID() } }, msg)
    ).rejects.toThrow();
    expect(acked()).toBe(false);
  });
});
