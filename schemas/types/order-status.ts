/**
 * Order lifecycle status.
 *
 * The application-level string values retain the original colon-delimited form
 * (`awaiting:payment`) so REST responses and DB rows are unchanged from the
 * pre-migration system.
 *
 * AVRO CONSTRAINT: Avro `enum` symbols must match `[A-Za-z_][A-Za-z0-9_]*` and
 * therefore cannot contain `:`. The `order-created.avsc` schema encodes the
 * awaiting-payment state as the symbol `awaiting_payment`. The two maps below
 * translate between the app enum and the Avro symbol at serialize/deserialize
 * time. Keeping the app value stable while giving Avro a legal symbol is the
 * cleanest way to satisfy both.
 */
export enum OrderStatus {
  /** Order created; the ticket it wants has not yet been reserved. */
  Created = 'created',

  /**
   * The ticket was already reserved, OR the user cancelled, OR the reservation
   * expired before payment. Terminal-ish: a cancelled order cannot be paid.
   */
  Cancelled = 'cancelled',

  /** The ticket is reserved for this order and it is awaiting payment. */
  AwaitingPayment = 'awaiting:payment',

  /** Payment succeeded. Success terminal state; the order is un-cancellable. */
  Complete = 'complete',
}

/** App enum value -> Avro enum symbol (used when serializing outgoing events). */
export const orderStatusToAvroSymbol: Record<OrderStatus, string> = {
  [OrderStatus.Created]: 'created',
  [OrderStatus.Cancelled]: 'cancelled',
  [OrderStatus.AwaitingPayment]: 'awaiting_payment',
  [OrderStatus.Complete]: 'complete',
};

/** Avro enum symbol -> app enum value (used when deserializing incoming events). */
export const avroSymbolToOrderStatus: Record<string, OrderStatus> = {
  created: OrderStatus.Created,
  cancelled: OrderStatus.Cancelled,
  awaiting_payment: OrderStatus.AwaitingPayment,
  complete: OrderStatus.Complete,
};
