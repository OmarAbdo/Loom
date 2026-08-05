import request from 'supertest';
import { app } from '../../app';

describe('OpenAPI docs', () => {
  it('serves the raw spec at /api/orders/docs.json', async () => {
    const res = await request(app).get('/api/orders/docs.json').expect(200);

    expect(res.body.openapi).toEqual('3.1.0');
    expect(res.body.info.title).toContain('orders');
  });

  it('documents every route the service exposes', async () => {
    const res = await request(app).get('/api/orders/docs.json').expect(200);

    expect(Object.keys(res.body.paths).sort()).toEqual([
      '/api/orders',
      '/api/orders/{orderId}',
    ]);
  });

  /**
   * The spec must stay readable without a session, even though every documented
   * route requires one — the aggregated /docs gateway fetches it anonymously.
   */
  it('serves the spec without authentication', async () => {
    await request(app).get('/api/orders/docs.json').expect(200);
  });

  it('serves the Swagger UI page rather than matching /:orderId', async () => {
    const res = await request(app).get('/api/orders/docs/').expect(200);

    expect(res.text).toContain('swagger-ui');
  });
});
