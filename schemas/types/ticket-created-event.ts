import { Subjects } from './subjects';

/**
 * TypeScript contract for the `ticket:created` event.
 *
 * Hand-authored to mirror `schemas/avro/ticket-created.avsc`. The guard test
 * (`schemas/src/__test__/schema-type-parity.test.ts`) fails if this interface
 * and the .avsc drift apart, so the two stay in sync without codegen.
 *
 * `subject` is the discriminant used by the base Publisher/Consumer to route
 * to the correct topic; it is NOT part of the Avro payload (the payload is the
 * `data` object).
 */
export interface TicketCreatedEvent {
  subject: Subjects.TicketCreated;
  data: {
    id: string;
    version: number;
    title: string;
    /** See money-as-double note in the .avsc. */
    price: number;
    userId: string;
  };
}
