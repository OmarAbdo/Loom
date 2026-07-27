import { Subjects } from './subjects';

/**
 * TypeScript contract for the `order:cancelled` event — the saga's compensating
 * action (also fired on explicit user cancellation).
 * Mirrors `schemas/avro/order-cancelled.avsc`.
 */
export interface OrderCancelledEvent {
  subject: Subjects.OrderCancelled;
  data: {
    id: string;
    version: number;
    ticket: {
      id: string;
    };
  };
}
