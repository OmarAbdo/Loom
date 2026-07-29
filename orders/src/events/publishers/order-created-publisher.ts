import { Publisher } from '@omarabdo/ticketing-common';
import { Subjects, OrderCreatedEvent } from '@omarabdo/ticketing-schemas';

/** Publishes order:created, keyed by order id so an order's events stay ordered. */
export class OrderCreatedPublisher extends Publisher<OrderCreatedEvent> {
  subject: Subjects.OrderCreated = Subjects.OrderCreated;

  protected key(data: OrderCreatedEvent['data']): string {
    return data.id;
  }
}
