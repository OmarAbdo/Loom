import { Listener, Message } from '@omarabdo/ticketing-common';
import { OrderCreatedEvent, Subjects } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { TicketRepository } from '../../repositories/ticket-repository';
import { TicketUpdatedPublisher } from '../publishers/ticket-updated-publisher';

/**
 * On order:created, reserve the ticket by setting its orderId, then publish
 * ticket:updated so downstream replicas learn of the reservation.
 */
export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
  subject: Subjects.OrderCreated = Subjects.OrderCreated;
  groupId = groupId;

  async onMessage(data: OrderCreatedEvent['data'], msg: Message): Promise<void> {
    const tickets = new TicketRepository(getDb());

    const ticket = await tickets.findById(data.ticket.id);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Reserve: set orderId. Version-guarded update bumps the version.
    const updated = await tickets.update(ticket.id, ticket.version, {
      orderId: data.id,
    });

    await new TicketUpdatedPublisher().publish({
      id: updated.id,
      price: updated.price,
      title: updated.title,
      userId: updated.userId,
      orderId: updated.orderId ?? undefined,
      version: updated.version,
    });

    msg.ack();
  }
}
