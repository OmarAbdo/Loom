import { Subjects } from './subjects';

/**
 * TypeScript contract for the `payment:created` event — the saga's success
 * signal that drives an order to Complete.
 * Mirrors `schemas/avro/payment-created.avsc`.
 */
export interface PaymentCreatedEvent {
  subject: Subjects.PaymentCreated;
  data: {
    id: string;
    orderId: string;
    stripeId: string;
  };
}
