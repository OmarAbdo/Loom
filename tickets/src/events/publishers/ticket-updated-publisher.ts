import { Publisher } from '@omarabdo/ticketing-common';
import { Subjects, TicketUpdatedEvent } from '@omarabdo/ticketing-schemas';

/**
 * Publishes ticket:updated. Keyed by the ticket id (same key as ticket:created)
 * so created/updated for one ticket are ordered on the same partition.
 */
export class TicketUpdatedPublisher extends Publisher<TicketUpdatedEvent> {
  subject: Subjects.TicketUpdated = Subjects.TicketUpdated;

  protected key(data: TicketUpdatedEvent['data']): string {
    return data.id;
  }
}
