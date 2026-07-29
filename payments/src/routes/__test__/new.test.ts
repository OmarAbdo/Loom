/**
 * Charge route (POST /api/payments) against real Postgres (Testcontainers),
 * with Stripe and the Publisher mocked. Seeds the local order replica via the repo.
 */
jest.mock('../../stripe');

import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../app';
import { getDb } from '../../db/connection';
import { OrderRepository } from '../../repositories/order-repository';
import { stripe } from '../../stripe';

async function seedOrder(opts: { userId: string; status?: 'created' | 'awaiting:payment' | 'cancelled'; price?: number }) {
  return new OrderRepository(getDb()).create({
    id: randomUUID(),
    userId: opts.userId,
    price: opts.price ?? 20,
    status: opts.status ?? 'created',
    version: 0,
  });
}

it('requires auth', async () => {
  await request(app).post('/api/payments').send({}).expect(401);
});

it('404s for an order that does not exist', async () => {
  await request(app)
    .post('/api/payments')
    .set('Cookie', global.signin())
    .send({ token: 'tok', orderId: randomUUID() })
    .expect(404);
});

it('401s paying for another user\'s order', async () => {
  const order = await seedOrder({ userId: randomUUID() });
  await request(app)
    .post('/api/payments')
    .set('Cookie', global.signin()) // different user
    .send({ token: 'tok', orderId: order.id })
    .expect(401);
});

it('400s paying for a cancelled order', async () => {
  const user = randomUUID();
  const order = await seedOrder({ userId: user, status: 'cancelled' });
  await request(app)
    .post('/api/payments')
    .set('Cookie', global.signin(user))
    .send({ token: 'tok', orderId: order.id })
    .expect(400);
});

it('creates a payment, charges Stripe, and publishes an event', async () => {
  const user = randomUUID();
  const order = await seedOrder({ userId: user, price: 25 });

  const res = await request(app)
    .post('/api/payments')
    .set('Cookie', global.signin(user))
    .send({ token: 'tok', orderId: order.id })
    .expect(201);

  // Stripe charged the order price in cents.
  expect((stripe.charges.create as jest.Mock)).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 25 * 100, currency: 'usd' })
  );
  // Payment persisted.
  const payment = await getDb().selectFrom('payments').selectAll().where('id', '=', res.body.id).executeTakeFirst();
  expect(payment).toBeTruthy();
  // Event published.
  expect(global.kafkaSend).toHaveBeenCalled();
});
