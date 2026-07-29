import Queue from 'bull';
import { ExpirationCompletePublisher } from '../events/publishers/expiration-complete-publisher';

interface Payload {
  orderId: string;
}

/**
 * Bull delayed-job queue backed by Redis. A job added with a `delay` fires at
 * that time; the processor then publishes expiration:complete over Kafka.
 */
const expirationQueue = new Queue<Payload>('order:expiration', {
  redis: {
    host: process.env.REDIS_HOST,
  },
});

expirationQueue.process(async (job) => {
  await new ExpirationCompletePublisher().publish({
    orderId: job.data.orderId,
  });
});

export { expirationQueue };
