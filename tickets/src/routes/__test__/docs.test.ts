import request from 'supertest';
import { app } from '../../app';

describe('OpenAPI docs', () => {
  it('serves the raw spec at /api/tickets/docs.json', async () => {
    const res = await request(app).get('/api/tickets/docs.json').expect(200);

    expect(res.body.openapi).toEqual('3.1.0');
    expect(res.body.info.title).toContain('tickets');
  });

  it('documents every route the service exposes', async () => {
    const res = await request(app).get('/api/tickets/docs.json').expect(200);

    expect(Object.keys(res.body.paths).sort()).toEqual([
      '/api/tickets',
      '/api/tickets/{id}',
    ]);
  });

  /**
   * Regression guard for a real ordering trap: `/api/tickets/:id` is registered
   * on the same prefix as the docs. If the docs mount ever moves below the
   * routers, "docs" is parsed as a ticket id and this returns 400 instead of
   * the Swagger page.
   */
  it('serves the Swagger UI page rather than matching /:id', async () => {
    const res = await request(app).get('/api/tickets/docs/').expect(200);

    expect(res.text).toContain('swagger-ui');
  });
});

describe('uuid param validation', () => {
  it('rejects a malformed ticket id with a 400 before it reaches Postgres', async () => {
    const res = await request(app).get('/api/tickets/not-a-uuid').expect(400);

    expect(res.body.errors[0].field).toEqual('id');
  });
});
