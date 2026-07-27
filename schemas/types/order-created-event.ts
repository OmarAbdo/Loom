import { Subjects } from './subjects';
import { OrderStatus } from './order-status';

/**
 * TypeScript contract for the `order:created` event — the event that STARTS the
 * purchase saga. Mirrors `schemas/avro/order-created.avsc`.
 *
 * Note: `status` is typed as the app-level `OrderStatus` (whose AwaitingPayment
 * value is `awaiting:payment`). The base Publisher/Consumer translate to/from
 * the Avro enum symbol (`awaiting_payment`) via the maps in order-status.ts.
 */
export interface OrderCreatedEvent {
  subject: Subjects.OrderCreated;
  data: {
    id: string;
    version: number;
    status: OrderStatus;
    userId: string;
    /** ISO-8601 timestamp string at which the reservation expires. */
    expiresAt: string;
    ticket: {
      id: string;
      /** See money-as-double note in the .avsc. */
      price: number;
    };
  };
}
