import { Subjects } from '../types/subjects';

/**
 * The single source of truth linking each Kafka topic to its Avro schema file
 * and its Schema Registry subject.
 *
 * Both the register script (`register.ts`) and the parity guard test consume
 * this map, so there is exactly one place that enumerates "the events that
 * exist" and how each maps to a schema.
 *
 * SUBJECT NAMING: Confluent's default TopicNameStrategy derives the registry
 * subject from the topic as `<topic>-value`. We follow that convention so the
 * serializer/deserializer (which use TopicNameStrategy by default) resolve the
 * same subject the register script wrote.
 */
export interface TopicSchema {
  /** Kafka topic name (the Subjects enum value). */
  topic: Subjects;
  /** Avro schema filename under schemas/avro/. */
  avscFile: string;
  /** Schema Registry subject: `<topic>-value`. */
  subject: string;
}

const withSubject = (topic: Subjects, avscFile: string): TopicSchema => ({
  topic,
  avscFile,
  subject: `${topic}-value`,
});

export const topicSchemas: TopicSchema[] = [
  withSubject(Subjects.TicketCreated, 'ticket-created.avsc'),
  withSubject(Subjects.TicketUpdated, 'ticket-updated.avsc'),
  withSubject(Subjects.OrderCreated, 'order-created.avsc'),
  withSubject(Subjects.OrderCancelled, 'order-cancelled.avsc'),
  withSubject(Subjects.ExpirationComplete, 'expiration-complete.avsc'),
  withSubject(Subjects.PaymentCreated, 'payment-created.avsc'),
];
