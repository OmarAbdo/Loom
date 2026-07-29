import { Publisher } from '@omarabdo/ticketing-common';
import { Subjects, OrderCancelledEvent } from '@omarabdo/ticketing-schemas';

/** Publishes order:cancelled, keyed by order id (same key as order:created). */
export class OrderCancelledPublisher extends Publisher<OrderCancelledEvent> {
  subject: Subjects.OrderCancelled = Subjects.OrderCancelled;

  protected key(data: OrderCancelledEvent['data']): string {
    return data.id;
  }
}
