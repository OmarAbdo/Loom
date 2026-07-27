import { Subjects } from './subjects';

/**
 * TypeScript contract for the `ticket:updated` event.
 * Mirrors `schemas/avro/ticket-updated.avsc`.
 */
export interface TicketUpdatedEvent {
  subject: Subjects.TicketUpdated;
  data: {
    id: string;
    version: number;
    title: string;
    /** See money-as-double note in the .avsc. */
    price: number;
    userId: string;
    /** UUID of the reserving order, or undefined/null when not reserved. */
    orderId?: string;
  };
}
