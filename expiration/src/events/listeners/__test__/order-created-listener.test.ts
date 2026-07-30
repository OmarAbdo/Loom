/**
 * Expiration OrderCreatedListener test.
 *
 * The listener computes a delay (expiresAt - now) and enqueues a Bull job. We
 * mock the queue module so no Redis is needed, and assert the job payload +
 * delay + that msg.ack() ran. No Testcontainers here — expiration has no DB.
 */
import type { Message } from '@omarabdo/ticketing-common';

// Mock the Bull-backed queue: capture add() calls.
const add = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../queues/expiration-queue', () => ({
  expirationQueue: { add: (...args: any[]) => add(...args) },
}));

import { OrderCreatedListener } from '../order-created-listener';

function fakeMsg() {
  let acked = false;
  return { msg: { ack: () => { acked = true; }, raw: {} as any } as Message, acked: () => acked };
}

beforeEach(() => jest.clearAllMocks());

it('enqueues a delayed job with delay ~= expiresAt - now and acks', async () => {
  const orderId = 'order-1';
  const expiresAt = new Date(Date.now() + 10_000).toISOString(); // 10s out
  const { msg, acked } = fakeMsg();

  await new OrderCreatedListener().onMessage(
    {
      id: orderId, version: 0, status: 'created' as any, userId: 'u1',
      expiresAt, ticket: { id: 't1', price: 5 },
    },
    msg
  );

  expect(add).toHaveBeenCalledTimes(1);
  const [payload, opts] = add.mock.calls[0];
  expect(payload).toEqual({ orderId });
  // delay within a small tolerance of 10s
  expect(opts.delay).toBeGreaterThan(8000);
  expect(opts.delay).toBeLessThanOrEqual(10000);
  expect(acked()).toBe(true);
});

it('clamps a past expiresAt to a non-negative delay', async () => {
  const { msg } = fakeMsg();
  await new OrderCreatedListener().onMessage(
    {
      id: 'order-2', version: 0, status: 'created' as any, userId: 'u1',
      expiresAt: new Date(Date.now() - 5000).toISOString(), // already past
      ticket: { id: 't1', price: 5 },
    },
    msg
  );
  const [, opts] = add.mock.calls[0];
  expect(opts.delay).toBe(0);
});
