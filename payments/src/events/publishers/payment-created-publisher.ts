import { Publisher } from '@omarabdo/ticketing-common';
import { Subjects, PaymentCreatedEvent } from '@omarabdo/ticketing-schemas';

/** Publishes payment:created, keyed by order id so it orders with that order's events. */
export class PaymentCreatedPublisher extends Publisher<PaymentCreatedEvent> {
  subject: Subjects.PaymentCreated = Subjects.PaymentCreated;

  protected key(data: PaymentCreatedEvent['data']): string {
    return data.orderId;
  }
}
