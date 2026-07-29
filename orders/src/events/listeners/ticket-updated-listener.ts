import { Listener, Message } from '@omarabdo/ticketing-common';
import { Subjects, TicketUpdatedEvent } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { TicketRepository } from '../../repositories/ticket-repository';

/**
 * On ticket:updated, advance the local replica IF this event is the immediate
 * successor of the version we hold (findByEvent). If not found, the event is a
 * duplicate or out of order → do NOT ack, so Kafka redelivers.
 */
export class TicketUpdatedListener extends Listener<TicketUpdatedEvent> {
  subject: Subjects.TicketUpdated = Subjects.TicketUpdated;
  groupId = groupId;

  async onMessage(data: TicketUpdatedEvent['data'], msg: Message): Promise<void> {
    const tickets = new TicketRepository(getDb());

    const ticket = await tickets.findByEvent(data);
    if (!ticket) {
      throw new Error('Ticket not found (out-of-order or duplicate event)');
    }

    await tickets.updateFromEvent(ticket.id, ticket.version, {
      title: data.title,
      price: data.price,
      version: data.version,
    });

    msg.ack();
  }
}
