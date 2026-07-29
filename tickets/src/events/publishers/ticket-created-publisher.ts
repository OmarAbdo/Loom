import { Publisher } from '@omarabdo/ticketing-common';
import { Subjects, TicketCreatedEvent } from '@omarabdo/ticketing-schemas';

/**
 * Publishes ticket:created. Keyed by the ticket id so all events about one
 * ticket land on the same partition and stay ordered (ADR-0001).
 */
export class TicketCreatedPublisher extends Publisher<TicketCreatedEvent> {
  subject: Subjects.TicketCreated = Subjects.TicketCreated;

  protected key(data: TicketCreatedEvent['data']): string {
    return data.id;
  }
}
