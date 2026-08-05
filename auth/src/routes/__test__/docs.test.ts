import request from 'supertest';
import { app } from '../../app';

/**
 * The docs endpoints are part of the service's public surface, so they get the
 * same treatment as any other route: a test that fails if they stop resolving.
 *
 * This is a real regression guard, not ceremony — the docs mount sits before
 * the `'*splat'` catch-all in app.ts, and moving it after would silently turn
 * every docs URL into a 404 that nothing else would catch.
 */
describe('OpenAPI docs', () => {
  it('serves the raw spec at /api/users/docs.json', async () => {
    const res = await request(app).get('/api/users/docs.json').expect(200);

    expect(res.body.openapi).toEqual('3.1.0');
    expect(res.body.info.title).toContain('auth');
  });

  it('documents every route the service exposes', async () => {
    const res = await request(app).get('/api/users/docs.json').expect(200);

    expect(Object.keys(res.body.paths).sort()).toEqual([
      '/api/users/currentuser',
      '/api/users/signin',
      '/api/users/signout',
      '/api/users/signup',
    ]);
  });

  it('never documents a password field on the User response', async () => {
    const res = await request(app).get('/api/users/docs.json').expect(200);

    const user = res.body.components.schemas.User;
    expect(Object.keys(user.properties)).toEqual(['id', 'email']);
  });

  it('serves the Swagger UI page at /api/users/docs', async () => {
    const res = await request(app).get('/api/users/docs/').expect(200);

    expect(res.text).toContain('swagger-ui');
  });
});
