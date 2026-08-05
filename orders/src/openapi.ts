/**
 * =============================================================================
 * orders service — OpenAPI document
 * =============================================================================
 *
 * Served at `/api/orders/docs` (Swagger UI) and `/api/orders/docs.json`.
 *
 * These four routes are the entry points to the reservation saga; each
 * description names the event the route publishes, so the HTTP docs and the
 * Avro contracts can be read together (see docs/architecture/saga.md).
 * =============================================================================
 */
import {
  OpenAPIRegistry,
  buildOpenApiDocument,
  errorResponses,
} from '@omarabdo/ticketing-common';
import {
  CreateOrderBody,
  OrderResponse,
  OrderListResponse,
  OrderIdParam,
} from './schemas';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/orders',
  tags: ['orders'],
  summary: "List the caller's orders",
  description:
    'Returns only orders belonging to the authenticated user, each with its ticket ' +
    'embedded from the local replica.',
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "The caller's orders.",
      content: { 'application/json': { schema: OrderListResponse } },
    },
    ...errorResponses(401),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/orders',
  tags: ['orders'],
  summary: 'Reserve a ticket',
  description:
    'Creates an order holding the ticket for 15 minutes and publishes ' +
    '`order.created`. Rejects with 400 if an active order already holds the ' +
    'ticket, and 404 if the ticket is not in this service\'s local replica — ' +
    'which also covers the brief window after a ticket is created but before ' +
    'its `ticket.created` event has been consumed here.',
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateOrderBody } } },
  },
  responses: {
    201: {
      description: 'Order created; `order.created` published.',
      content: { 'application/json': { schema: OrderResponse } },
    },
    ...errorResponses(400, 401, 404),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/orders/{orderId}',
  tags: ['orders'],
  summary: 'Fetch one order',
  description: 'Readable only by the user who owns the order.',
  security: [{ sessionCookie: [] }],
  request: { params: OrderIdParam },
  responses: {
    200: {
      description: 'The order, with its ticket embedded.',
      content: { 'application/json': { schema: OrderResponse } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/orders/{orderId}',
  tags: ['orders'],
  summary: 'Cancel an order',
  description:
    'Marks the order cancelled and publishes `order.cancelled`, which releases the ' +
    'ticket reservation in the tickets service. This is a SOFT cancel — the row ' +
    'remains, with status `cancelled`.\n\n' +
    'Responds **204 No Content**. Note that the handler passes the cancelled order ' +
    'to `res.send()`, but a 204 response carries no body by definition, so clients ' +
    'receive an empty body and must not depend on one.',
  security: [{ sessionCookie: [] }],
  request: { params: OrderIdParam },
  responses: {
    204: {
      description: 'Order cancelled; `order.cancelled` published. No body.',
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

export const openApiDocument = buildOpenApiDocument(registry, {
  title: 'Ticketing — orders service',
  version: '1.0.0',
  description:
    'Owns reservations and drives the saga. Publishes `order.created` and ' +
    '`order.cancelled`; consumes `ticket.created`, `ticket.updated`, ' +
    '`expiration.complete`, and `payment.created`. Ticket data served here comes ' +
    'from a local replica built from events, never from a call to the tickets service.',
});
