import { Listener, Message } from '@omarabdo/ticketing-common';
import { Subjects, TicketCreatedEvent } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { TicketRepository } from '../../repositories/ticket-repository';

/** On ticket:created, insert the ticket into the local replica. */
export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
  subject: Subjects.TicketCreated = Subjects.TicketCreated;
  groupId = groupId;

  async onMessage(data: TicketCreatedEvent['data'], msg: Message): Promise<void> {
    const tickets = new TicketRepository(getDb());
    await tickets.create({
      id: data.id,
      title: data.title,
      price: data.price,
      version: data.version,
    });
    msg.ack();
  }
}
