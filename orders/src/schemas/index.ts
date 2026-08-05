/**
 * =============================================================================
 * orders service — HTTP contracts (ADR-0007)
 * =============================================================================
 *
 * The synchronous half of this service's contract surface. The asynchronous
 * half is `schemas/avro/order-created.avsc` and `order-cancelled.avsc`
 * (published), plus the ticket/payment/expiration events it consumes.
 *
 * THE EMBEDDED TICKET IS A REPLICA, NOT A JOIN ACROSS SERVICES. Orders keeps
 * its own `tickets` table, populated from `ticket.created` / `ticket.updated`.
 * Every ticket field below is served from that local replica — no synchronous
 * call to the tickets service happens on any of these routes. That is the point
 * of the event-carried state transfer (ADR-0002): orders stays available when
 * tickets is down.
 * =============================================================================
 */
import { z } from '@omarabdo/ticketing-common';

/**
 * Order status.
 *
 * These four values mirror the `OrderStatus` Avro enum, with one wire-level
 * difference worth knowing: Avro enum symbols cannot contain ':', so the event
 * spells the second state `AwaitingPayment` while the database column and this
 * HTTP contract use the original `awaiting:payment`. The publisher maps between
 * them. Changing either side without the other silently breaks the saga.
 */
export const OrderStatusSchema = z
  .enum(['created', 'awaiting:payment', 'complete', 'cancelled'])
  .openapi('OrderStatus', {
    description:
      'created -> awaiting:payment -> complete, or -> cancelled (by the user, ' +
      'or by the expiration service when the 15-minute window elapses).',
  });

/**
 * The ticket as embedded in an order response, served from the local replica.
 *
 * `version` is the REPLICA's version — the version of the last ticket event
 * this service successfully applied. It is not necessarily the tickets
 * service's current version, and a client must not treat it as such.
 */
export const EmbeddedTicket = z
  .object({
    id: z.uuid(),
    title: z.string().openapi({ example: 'concert' }),
    price: z.number().openapi({ example: 20 }),
    version: z.number().int().openapi({
      description: "The local replica's version, not the ticket owner's.",
    }),
  })
  .openapi('EmbeddedTicket');

/**
 * The lighter ticket shape returned by the LIST route.
 *
 * DELIBERATELY DIFFERENT from `EmbeddedTicket`: the list query joins and selects
 * only id/title/price, so it has no `version` to report. Documenting the two
 * shapes separately reflects what the endpoints actually return rather than
 * promising a uniformity the code does not have. Worth collapsing one day —
 * but that would be an API change, not a docs change, so it is recorded here
 * rather than quietly "fixed" during a validation migration.
 */
export const ListEmbeddedTicket = z
  .object({
    id: z.uuid(),
    title: z.string(),
    price: z.number(),
  })
  .openapi('ListEmbeddedTicket');

/** An order with its ticket embedded — the shape returned by create and show. */
export const OrderResponse = z
  .object({
    id: z.uuid(),
    userId: z.uuid().openapi({
      description: 'Owner. Only this user may read or cancel the order.',
    }),
    status: OrderStatusSchema,
    expiresAt: z
      .union([z.string(), z.date()])
      .nullable()
      .openapi({
        type: 'string',
        format: 'date-time',
        description:
          'When the reservation lapses (15 minutes after creation). The ' +
          'expiration service cancels the order at this time unless it has been ' +
          'paid. Null once the order reaches a terminal state.',
      }),
    ticketId: z.uuid(),
    version: z.number().int().openapi({
      description: "The order's own OCC version, carried on order.* events.",
    }),
    ticket: EmbeddedTicket.optional(),
  })
  .openapi('Order');

/** `GET /api/orders` — the caller's orders, each with the light ticket shape. */
export const OrderListResponse = z
  .array(
    OrderResponse.omit({ ticketId: true, ticket: true }).extend({
      ticket: ListEmbeddedTicket,
    })
  )
  .openapi('OrderList');

/**
 * `POST /api/orders` body.
 *
 * `ticketId` must be a uuid AND must name a ticket present in the local
 * replica; a ticket that exists in the tickets service but whose `ticket.created`
 * event has not yet been consumed here produces a 404. That window is normally
 * milliseconds, and is the visible cost of eventual consistency.
 */
export const CreateOrderBody = z
  .object({
    ticketId: z
      .string({ message: 'TicketId must be provided' })
      .min(1, { message: 'TicketId must be provided' })
      .uuid({ message: 'TicketId must be a valid uuid' })
      .openapi({ example: '3f1a8c2e-9b4d-4f7a-8e21-0c5d6a7b8e90' }),
  })
  .openapi('CreateOrderRequest');

/** `:orderId` path parameter. Note the name — this service does not use `:id`. */
export const OrderIdParam = z.object({
  orderId: z.uuid({ message: 'Order id must be a valid uuid' }),
});

export type OrderResponseType = z.infer<typeof OrderResponse>;
export type CreateOrderBodyType = z.infer<typeof CreateOrderBody>;
