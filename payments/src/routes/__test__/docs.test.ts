// Importing `app` pulls in the charge route and therefore src/stripe.ts, which
// constructs a real Stripe client at module scope. Mocked here for the same
// reason new.test.ts mocks it: these tests must not need a live STRIPE_KEY.
jest.mock('../../stripe');

import request from 'supertest';
import { app } from '../../app';

describe('OpenAPI docs', () => {
  it('serves the raw spec at /api/payments/docs.json', async () => {
    const res = await request(app).get('/api/payments/docs.json').expect(200);

    expect(res.body.openapi).toEqual('3.1.0');
    expect(res.body.info.title).toContain('payments');
  });

  it('documents the charge route', async () => {
    const res = await request(app).get('/api/payments/docs.json').expect(200);

    expect(Object.keys(res.body.paths)).toEqual(['/api/payments']);
  });

  /**
   * Two contract guarantees worth pinning, both security-relevant:
   * the request accepts a Stripe token and never raw card fields, and the
   * response exposes only the payment id — never the stripeId charge handle.
   */
  it('accepts only a token, never card details', async () => {
    const res = await request(app).get('/api/payments/docs.json').expect(200);

    const body = res.body.components.schemas.CreatePaymentRequest;
    expect(Object.keys(body.properties).sort()).toEqual(['orderId', 'token']);
  });

  it('never documents stripeId on the payment response', async () => {
    const res = await request(app).get('/api/payments/docs.json').expect(200);

    expect(Object.keys(res.body.components.schemas.Payment.properties)).toEqual([
      'id',
    ]);
  });

  it('serves the Swagger UI page at /api/payments/docs', async () => {
    const res = await request(app).get('/api/payments/docs/').expect(200);

    expect(res.text).toContain('swagger-ui');
  });
});
