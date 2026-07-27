import { Subjects } from './subjects';

/**
 * TypeScript contract for the `expiration:complete` event.
 * Mirrors `schemas/avro/expiration-complete.avsc`.
 */
export interface ExpirationCompleteEvent {
  subject: Subjects.ExpirationComplete;
  data: {
    orderId: string;
  };
}
