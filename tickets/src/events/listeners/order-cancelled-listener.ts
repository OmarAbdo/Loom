import { Listener, Message } from '@omarabdo/ticketing-common';
import { OrderCancelledEvent, Subjects } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { TicketRepository } from '../../repositories/ticket-repository';
import { TicketUpdatedPublisher } from '../publishers/ticket-updated-publisher';

/**
 * On order:cancelled, release the ticket by clearing its orderId, then publish
 * ticket:updated so the ticket becomes available again downstream.
 */
export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
  subject: Subjects.OrderCancelled = Subjects.OrderCancelled;
  groupId = groupId;

  async onMessage(data: OrderCancelledEvent['data'], msg: Message): Promise<void> {
    const tickets = new TicketRepository(getDb());

    const ticket = await tickets.findById(data.ticket.id);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Release: clear orderId. Version-guarded update bumps the version.
    const updated = await tickets.update(ticket.id, ticket.version, {
      orderId: null,
    });

    await new TicketUpdatedPublisher().publish({
      id: updated.id,
      orderId: updated.orderId ?? undefined,
      userId: updated.userId,
      price: updated.price,
      title: updated.title,
      version: updated.version,
    });

    msg.ack();
  }
}
