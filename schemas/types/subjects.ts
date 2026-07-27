/**
 * Kafka topic names (a.k.a. "subjects" in the original NATS design).
 *
 * These string values are the Kafka **topic** names. Each also has a Schema
 * Registry subject derived by the default TopicNameStrategy: `<topic>-value`
 * (e.g. topic `ticket:created` -> registry subject `ticket:created-value`).
 *
 * We keep the original colon-delimited names (`ticket:created`) so the wire
 * topic names are unchanged from the pre-migration system. Kafka topic names
 * permit `:`, so this is valid. (Contrast with Avro *enum symbols*, which may
 * NOT contain `:` — see OrderStatus below.)
 */
export enum Subjects {
  TicketCreated = 'ticket:created',
  TicketUpdated = 'ticket:updated',

  OrderCreated = 'order:created',
  OrderCancelled = 'order:cancelled',

  ExpirationComplete = 'expiration:complete',

  PaymentCreated = 'payment:created',
}
