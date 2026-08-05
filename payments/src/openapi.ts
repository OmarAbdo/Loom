/**
 * =============================================================================
 * payments service — OpenAPI document
 * =============================================================================
 *
 * Served at `/api/payments/docs` (Swagger UI) and `/api/payments/docs.json`.
 * One route, but the one that moves money — the description records the
 * authorization rules that guard it.
 * =============================================================================
 */
import {
  OpenAPIRegistry,
  buildOpenApiDocument,
  errorResponses,
} from '@omarabdo/ticketing-common';
import { CreatePaymentBody, PaymentResponse } from './schemas';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'post',
  path: '/api/payments',
  tags: ['payments'],
  summary: 'Pay for an order',
  description:
    'Charges the order via Stripe and publishes `payment.created`, which completes ' +
    'the order in the orders service.\n\n' +
    'The amount is read from the local order replica, never from the request — a ' +
    'client-supplied amount would let a caller pay one cent for any order.\n\n' +
    'Three guards apply, in order: the order must exist (404), it must belong to ' +
    'the caller (403), and it must not already be cancelled (400) — including ' +
    'cancellation by the expiration service after the 15-minute window.',
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreatePaymentBody } } },
  },
  responses: {
    201: {
      description: 'Charge succeeded; `payment.created` published.',
      content: { 'application/json': { schema: PaymentResponse } },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

export const openApiDocument = buildOpenApiDocument(registry, {
  title: 'Ticketing — payments service',
  version: '1.0.0',
  description:
    'Charges orders through Stripe and publishes `payment.created`. Consumes ' +
    '`order.created` and `order.cancelled` to maintain a local order replica, so ' +
    'it can price and authorize a charge without calling the orders service. ' +
    'Card details never reach this service — only single-use Stripe tokens.',
});
