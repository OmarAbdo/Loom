/**
 * Orders HTTP route tests against real Postgres (Testcontainers).
 * Seeds the local ticket replica directly via the repo, then drives the routes.
 */
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../app';
import { getDb } from '../../db/connection';
import { TicketRepository } from '../../repositories/ticket-repository';

async function seedTicket(price = 20) {
  const id = randomUUID();
  return new TicketRepository(getDb()).create({ id, title: 'concert', price, version: 0 });
}

describe('POST /api/orders', () => {
  it('requires auth', async () => {
    await request(app).post('/api/orders').send({}).expect(401);
  });

  it('404s when the ticket does not exist', async () => {
    await request(app)
      .post('/api/orders')
      .set('Cookie', global.signin())
      .send({ ticketId: randomUUID() })
      .expect(404);
  });

  it('creates an order and publishes an event', async () => {
    const ticket = await seedTicket();
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', global.signin())
      .send({ ticketId: ticket.id })
      .expect(201);

    expect(res.body.status).toBe('created');
    expect(res.body.ticket.id).toBe(ticket.id);
    expect(global.kafkaSend).toHaveBeenCalled();
  });

  it('rejects ordering an already-reserved ticket', async () => {
    const ticket = await seedTicket();
    await request(app).post('/api/orders').set('Cookie', global.signin()).send({ ticketId: ticket.id }).expect(201);
    // Second order for the same ticket must fail.
    await request(app).post('/api/orders').set('Cookie', global.signin()).send({ ticketId: ticket.id }).expect(400);
  });
});

describe('GET /api/orders', () => {
  it('lists only the current user\'s orders', async () => {
    const userA = randomUUID();
    const t1 = await seedTicket();
    const t2 = await seedTicket();
    await request(app).post('/api/orders').set('Cookie', global.signin(userA)).send({ ticketId: t1.id }).expect(201);
    await request(app).post('/api/orders').set('Cookie', global.signin()).send({ ticketId: t2.id }).expect(201);

    const res = await request(app).get('/api/orders').set('Cookie', global.signin(userA)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ticket.title).toBe('concert');
  });
});

describe('GET /api/orders/:id', () => {
  it('404s for a missing order', async () => {
    await request(app).get(`/api/orders/${randomUUID()}`).set('Cookie', global.signin()).expect(404);
  });

  it('401s when fetching another user\'s order', async () => {
    const ticket = await seedTicket();
    const created = await request(app).post('/api/orders').set('Cookie', global.signin()).send({ ticketId: ticket.id }).expect(201);
    await request(app).get(`/api/orders/${created.body.id}`).set('Cookie', global.signin()).expect(401);
  });

  it('returns the order with its ticket for the owner', async () => {
    const ticket = await seedTicket();
    const owner = global.signin();
    const created = await request(app).post('/api/orders').set('Cookie', owner).send({ ticketId: ticket.id }).expect(201);
    const res = await request(app).get(`/api/orders/${created.body.id}`).set('Cookie', owner).expect(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.ticket.id).toBe(ticket.id);
  });
});

describe('DELETE /api/orders/:id', () => {
  it('cancels the order and publishes an event', async () => {
    const ticket = await seedTicket();
    const owner = global.signin();
    const created = await request(app).post('/api/orders').set('Cookie', owner).send({ ticketId: ticket.id }).expect(201);
    jest.clearAllMocks();

    await request(app).delete(`/api/orders/${created.body.id}`).set('Cookie', owner).expect(204);
    expect(global.kafkaSend).toHaveBeenCalled();

    const fetched = await request(app).get(`/api/orders/${created.body.id}`).set('Cookie', owner).expect(200);
    expect(fetched.body.status).toBe('cancelled');
  });
});
