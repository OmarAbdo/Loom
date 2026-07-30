/**
 * Listener tests for tickets: reserve on order.created, release on order.cancelled.
 *
 * Runs under the default jest config (src/test/setup.ts), which boots a real
 * Testcontainers Postgres, wires the shared connectDb singleton, and mocks the
 * base Publisher to a `global.kafkaSend` spy. We seed a ticket via the repo,
 * invoke the listener's onMessage directly with a fake Message, and assert the
 * DB effect + that a ticket.updated event was published + that msg.ack() ran.
 */
import { randomUUID } from 'crypto';
import { getDb } from '../../../db/connection';
import { TicketRepository } from '../../../repositories/ticket-repository';
import { OrderCreatedListener } from '../order-created-listener';
import { OrderCancelledListener } from '../order-cancelled-listener';
import type { Message } from '@omarabdo/ticketing-common';

function fakeMsg(): { msg: Message; acked: () => boolean } {
  let acked = false;
  return {
    msg: { ack: () => { acked = true; }, raw: {} as any },
    acked: () => acked,
  };
}

async function seedTicket() {
  return new TicketRepository(getDb()).create({
    title: 'concert',
    price: 20,
    userId: randomUUID(),
  });
}

describe('OrderCreatedListener (tickets)', () => {
  it('reserves the ticket (sets orderId, bumps version) and publishes + acks', async () => {
    const ticket = await seedTicket();
    const orderId = randomUUID();
    const { msg, acked } = fakeMsg();

    await new OrderCreatedListener().onMessage(
      {
        id: orderId,
        version: 0,
        status: 'created' as any,
        userId: randomUUID(),
        expiresAt: new Date().toISOString(),
        ticket: { id: ticket.id, price: ticket.price },
      },
      msg
    );

    const updated = await new TicketRepository(getDb()).findById(ticket.id);
    expect(updated!.orderId).toBe(orderId);
    expect(updated!.version).toBe(1);
    expect(global.kafkaSend).toHaveBeenCalled(); // ticket.updated published
    expect(acked()).toBe(true);
  });

  it('throws (does not ack) when the ticket does not exist', async () => {
    const { msg, acked } = fakeMsg();
    await expect(
      new OrderCreatedListener().onMessage(
        {
          id: randomUUID(), version: 0, status: 'created' as any,
          userId: randomUUID(), expiresAt: new Date().toISOString(),
          ticket: { id: randomUUID(), price: 10 },
        },
        msg
      )
    ).rejects.toThrow('Ticket not found');
    expect(acked()).toBe(false);
  });
});

describe('OrderCancelledListener (tickets)', () => {
  it('releases the ticket (clears orderId, bumps version) and publishes + acks', async () => {
    // Seed a ticket already reserved.
    const repo = new TicketRepository(getDb());
    const ticket = await repo.create({ title: 'x', price: 20, userId: randomUUID() });
    const orderId = randomUUID();
    const reserved = await repo.update(ticket.id, ticket.version, { orderId });

    const { msg, acked } = fakeMsg();
    await new OrderCancelledListener().onMessage(
      { id: orderId, version: 1, ticket: { id: ticket.id } },
      msg
    );

    const after = await repo.findById(ticket.id);
    expect(after!.orderId).toBeNull();
    expect(after!.version).toBe(reserved.version + 1);
    expect(global.kafkaSend).toHaveBeenCalled();
    expect(acked()).toBe(true);
  });
});
