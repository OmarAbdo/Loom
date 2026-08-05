/**
 * =============================================================================
 * payments service — HTTP contracts (ADR-0007)
 * =============================================================================
 *
 * The synchronous half of this service's contract surface; the asynchronous
 * half is `schemas/avro/payment-created.avsc`.
 *
 * PCI NOTE — WHY `token` AND NOT CARD FIELDS: the browser sends raw card
 * details directly to Stripe, which returns a single-use token. Only that token
 * reaches this service. No card number, CVC, or expiry ever touches our
 * infrastructure, which is what keeps the system out of PCI-DSS scope. A schema
 * that accepted card fields here would be a serious regression, so this file is
 * the right place to record that the omission is deliberate.
 * =============================================================================
 */
import { z } from '@omarabdo/ticketing-common';

/**
 * `POST /api/payments` body.
 *
 * The order is charged for `order.price` read from the LOCAL REPLICA — the
 * client does not supply an amount. That is deliberate: a client-supplied
 * amount would let a caller pay one cent for any order.
 */
export const CreatePaymentBody = z
  .object({
    token: z
      .string({ message: 'Token must be provided' })
      .min(1, { message: 'Token must be provided' })
      .openapi({
        description:
          'A single-use Stripe token produced by Stripe.js in the browser. Raw card ' +
          'details are never sent to this service.',
        example: 'tok_visa',
      }),
    orderId: z
      .string({ message: 'OrderId must be provided' })
      .min(1, { message: 'OrderId must be provided' })
      .uuid({ message: 'OrderId must be a valid uuid' })
      .openapi({ example: '3f1a8c2e-9b4d-4f7a-8e21-0c5d6a7b8e90' }),
  })
  .openapi('CreatePaymentRequest');

/**
 * `POST /api/payments` response — the payment id and nothing else.
 *
 * NARROW ON PURPOSE. The stored payment row also holds `stripeId`, the charge
 * identifier at Stripe. It is not returned, and this schema is what enforces
 * that: were the handler ever changed to send the whole row, the documented
 * contract would still say `{ id }`, and the mismatch is the signal.
 */
export const PaymentResponse = z
  .object({
    id: z.uuid().openapi({
      description: "The payment record's id in this service.",
      example: '3f1a8c2e-9b4d-4f7a-8e21-0c5d6a7b8e90',
    }),
  })
  .openapi('Payment');

export type CreatePaymentBodyType = z.infer<typeof CreatePaymentBody>;
