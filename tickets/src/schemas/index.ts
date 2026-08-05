/**
 * =============================================================================
 * tickets service — HTTP contracts (ADR-0006)
 * =============================================================================
 *
 * The synchronous half of this service's contract surface. The asynchronous
 * half lives in `schemas/avro/ticket-created.avsc` and `ticket-updated.avsc`,
 * governed by the Schema Registry.
 *
 * RELATIONSHIP TO THE AVRO CONTRACTS: `TicketResponse` and the ticket events
 * describe the same entity but are NOT the same contract and must not be
 * collapsed into one. The event carries `{ id, title, price, userId, version }`
 * — no `orderId`, because reservation state is orders' concern, not something
 * downstream consumers rebuild from. The HTTP response DOES expose `orderId`,
 * because the client needs to render whether a ticket is reserved. They evolve
 * under different compatibility rules: the Avro schema is checked by the
 * registry on register, this one is checked by review.
 *
 * PRICE IS A NUMBER, NOT A STRING: `z.coerce.number()` accepts the string form
 * a form post sends ("20") and hands the handler a real number, which is what
 * the numeric column and the Avro `double` both require.
 * =============================================================================
 */
import { z } from '@omarabdo/ticketing-common';

/**
 * A ticket as returned over HTTP.
 *
 * `version` is exposed deliberately: it is the optimistic-concurrency token
 * (see docs/concepts/optimistic-concurrency.md), and a client that reads a
 * ticket and later reasons about staleness needs to see it.
 */
export const TicketResponse = z
  .object({
    id: z.uuid().openapi({
      example: '3f1a8c2e-9b4d-4f7a-8e21-0c5d6a7b8e90',
    }),
    title: z.string().openapi({ example: 'concert' }),
    price: z.number().openapi({ example: 20 }),
    userId: z.uuid().openapi({
      description: 'The user who created the ticket; only they may edit it.',
    }),
    orderId: z
      .string()
      .nullable()
      .openapi({
        description:
          'Set when an active order has reserved this ticket. A reserved ticket ' +
          'cannot be edited. Null when available.',
      }),
    version: z.number().int().openapi({
      description:
        'Optimistic-concurrency version, bumped on every update and carried on the ' +
        'ticket.updated event so consumers can order writes.',
      example: 0,
    }),
  })
  .openapi('Ticket');

/** `GET /api/tickets` — every ticket, reserved or not. */
export const TicketListResponse = z
  .array(TicketResponse)
  .openapi('TicketList');

/**
 * Body for creating and for updating a ticket.
 *
 * Both routes take the same shape, so they share one schema rather than two
 * identical ones that could drift apart. The messages match the strings the
 * previous express-validator chains produced, so client-visible copy is
 * unchanged by the migration.
 */
export const TicketBody = z
  .object({
    title: z
      .string({ message: 'Title is required' })
      .trim()
      .min(1, { message: 'Title is required' })
      .openapi({ example: 'concert' }),
    price: z.coerce
      .number({ message: 'Price must be greater than 0' })
      .positive({ message: 'Price must be greater than 0' })
      .openapi({
        description: 'Must be greater than zero. Accepts a numeric string.',
        example: 20,
      }),
  })
  .openapi('TicketRequest');

/**
 * `:id` path parameter.
 *
 * Validating this is a real hardening step, not decoration: `id` goes straight
 * into a `where id = ?` against a uuid column, so before this a malformed id
 * reached Postgres and surfaced as a driver error (a masked 400 from
 * errorHandler) rather than a clean validation failure.
 */
export const TicketIdParam = z.object({
  id: z.uuid({ message: 'Ticket id must be a valid uuid' }),
});

export type TicketBodyType = z.infer<typeof TicketBody>;
export type TicketResponseType = z.infer<typeof TicketResponse>;
