/**
 * =============================================================================
 * tickets service — OpenAPI document
 * =============================================================================
 *
 * Served at `/api/tickets/docs` (Swagger UI) and `/api/tickets/docs.json`.
 * See the header of auth/src/openapi.ts for why registration lives in its own
 * file rather than beside each route.
 * =============================================================================
 */
import {
  OpenAPIRegistry,
  buildOpenApiDocument,
  errorResponses,
} from '@omarabdo/ticketing-common';
import {
  TicketBody,
  TicketResponse,
  TicketListResponse,
  TicketIdParam,
} from './schemas';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/tickets',
  tags: ['tickets'],
  summary: 'List all tickets',
  description:
    'Returns every ticket, including reserved ones (those with a non-null orderId). ' +
    'Unauthenticated — the catalogue is public.',
  responses: {
    200: {
      description: 'All tickets.',
      content: { 'application/json': { schema: TicketListResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/tickets',
  tags: ['tickets'],
  summary: 'Create a ticket',
  description:
    'Creates a ticket owned by the caller, then publishes `ticket.created` to Kafka. ' +
    'The event is published only after the row is committed, keyed by ticket id so ' +
    'all events for one ticket land on the same partition and stay ordered.',
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { 'application/json': { schema: TicketBody } } },
  },
  responses: {
    201: {
      description: 'Ticket created; `ticket.created` published.',
      content: { 'application/json': { schema: TicketResponse } },
    },
    ...errorResponses(400, 401),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/tickets/{id}',
  tags: ['tickets'],
  summary: 'Fetch one ticket',
  request: { params: TicketIdParam },
  responses: {
    200: {
      description: 'The ticket.',
      content: { 'application/json': { schema: TicketResponse } },
    },
    ...errorResponses(400, 404),
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/tickets/{id}',
  tags: ['tickets'],
  summary: 'Edit a ticket',
  description:
    'Updates title and price, then publishes `ticket.updated` with the bumped ' +
    'version. Two rules constrain this: only the owner may edit (403 otherwise), ' +
    'and a ticket reserved by an active order cannot be edited at all (400) — ' +
    'otherwise a price could change out from under an in-flight order.',
  security: [{ sessionCookie: [] }],
  request: {
    params: TicketIdParam,
    body: { content: { 'application/json': { schema: TicketBody } } },
  },
  responses: {
    200: {
      description: 'Ticket updated; `ticket.updated` published.',
      content: { 'application/json': { schema: TicketResponse } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

export const openApiDocument = buildOpenApiDocument(registry, {
  title: 'Ticketing — tickets service',
  version: '1.0.0',
  description:
    'Owns the ticket catalogue. Publishes `ticket.created` and `ticket.updated`; ' +
    'consumes `order.created` and `order.cancelled` to set and clear reservations. ' +
    'Event contracts are Avro (schemas/avro); the HTTP contracts are documented here.',
});
