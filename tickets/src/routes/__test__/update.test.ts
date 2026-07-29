import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../app';
import { getDb } from '../../db/connection';
import { TicketRepository } from '../../repositories/ticket-repository';

it('returns a 404 if the provided id does not exist', async () => {
  const id = randomUUID();
  await request(app)
    .put(`/api/tickets/${id}`)
    .set('Cookie', global.signin())
    .send({ title: 'x', price: 20 })
    .expect(404);
});

it('returns a 401 if the user is not authenticated', async () => {
  const id = randomUUID();
  await request(app).put(`/api/tickets/${id}`).send({ title: 'x', price: 20 }).expect(401);
});

it('returns a 401 if the user does not own the ticket', async () => {
  const response = await request(app)
    .post('/api/tickets')
    .set('Cookie', global.signin())
    .send({ title: 'x', price: 20 });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', global.signin()) // different user
    .send({ title: 'y', price: 1000 })
    .expect(401);
});

it('returns a 400 if the user provides an invalid title or price', async () => {
  const cookie = global.signin();
  const response = await request(app)
    .post('/api/tickets')
    .set('Cookie', cookie)
    .send({ title: 'x', price: 20 });

  await request(app).put(`/api/tickets/${response.body.id}`).set('Cookie', cookie).send({ title: '', price: 20 }).expect(400);
  await request(app).put(`/api/tickets/${response.body.id}`).set('Cookie', cookie).send({ title: 'y', price: -10 }).expect(400);
});

it('updates the ticket provided valid inputs', async () => {
  const cookie = global.signin();
  const response = await request(app)
    .post('/api/tickets')
    .set('Cookie', cookie)
    .send({ title: 'x', price: 20 });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send({ title: 'new title', price: 100 })
    .expect(200);

  const ticketResponse = await request(app).get(`/api/tickets/${response.body.id}`).send();
  expect(ticketResponse.body.title).toEqual('new title');
  expect(ticketResponse.body.price).toEqual(100);
  expect(ticketResponse.body.version).toEqual(1); // OCC bumped
});

it('publishes an event', async () => {
  const cookie = global.signin();
  const response = await request(app)
    .post('/api/tickets')
    .set('Cookie', cookie)
    .send({ title: 'x', price: 20 });

  jest.clearAllMocks(); // ignore the create publish
  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send({ title: 'new title', price: 100 })
    .expect(200);

  expect(global.kafkaSend).toHaveBeenCalled();
});

it('rejects updates if the ticket is reserved', async () => {
  const cookie = global.signin();
  const response = await request(app)
    .post('/api/tickets')
    .set('Cookie', cookie)
    .send({ title: 'x', price: 20 });

  // Reserve the ticket directly via the repo (set orderId).
  const tickets = new TicketRepository(getDb());
  await tickets.update(response.body.id, response.body.version, {
    orderId: randomUUID(),
  });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set('Cookie', cookie)
    .send({ title: 'new title', price: 100 })
    .expect(400);
});
