import { Publisher } from '@omarabdo/ticketing-common';
import { Subjects, ExpirationCompleteEvent } from '@omarabdo/ticketing-schemas';

/** Publishes expiration:complete, keyed by order id for per-order ordering. */
export class ExpirationCompletePublisher extends Publisher<ExpirationCompleteEvent> {
  subject: Subjects.ExpirationComplete = Subjects.ExpirationComplete;

  protected key(data: ExpirationCompleteEvent['data']): string {
    return data.orderId;
  }
}
