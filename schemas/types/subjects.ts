/**
 * Kafka topic names (a.k.a. "subjects" in the original NATS design).
 *
 * These string values are the Kafka **topic** names. Each also has a Schema
 * Registry subject derived by the default TopicNameStrategy: `<topic>-value`
 * (e.g. topic `ticket.created` -> registry subject `ticket.created-value`).
 *
 * NAMING CONSTRAINT: Kafka topic names may contain only ASCII alphanumerics,
 * `.`, `_`, and `-`. Grider's NATS channels used a colon (`ticket:created`), but
 * Kafka REJECTS `:` in a topic name (InvalidTopicException). So we use the
 * conventional dot-delimited form (`ticket.created`). This changed from the
 * pre-migration wire names — acceptable because nothing is in production and it
 * is the correct Kafka convention. (The same `:` restriction also applies to
 * Avro enum symbols — see OrderStatus.)
 */
export enum Subjects {
  TicketCreated = 'ticket.created',
  TicketUpdated = 'ticket.updated',

  OrderCreated = 'order.created',
  OrderCancelled = 'order.cancelled',

  ExpirationComplete = 'expiration.complete',

  PaymentCreated = 'payment.created',
}
