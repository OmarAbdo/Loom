import { kafkaWrapper } from '@omarabdo/ticketing-common';
import { OrderCreatedListener } from './events/listeners/order-created-listener';

const start = async () => {
  const { KAFKA_BROKERS, KAFKA_CLIENT_ID, SCHEMA_REGISTRY_URL, REDIS_HOST } =
    process.env;
  if (!KAFKA_BROKERS) throw new Error('KAFKA_BROKERS must be defined');
  if (!KAFKA_CLIENT_ID) throw new Error('KAFKA_CLIENT_ID must be defined');
  if (!SCHEMA_REGISTRY_URL) throw new Error('SCHEMA_REGISTRY_URL must be defined');
  if (!REDIS_HOST) throw new Error('REDIS_HOST must be defined');

  // Init must succeed or crash so k8s restarts (do not swallow init errors).
  await kafkaWrapper.connect(
    KAFKA_CLIENT_ID,
    KAFKA_BROKERS.split(','),
    SCHEMA_REGISTRY_URL
  );
  process.on('SIGINT', () => kafkaWrapper.disconnect());
  process.on('SIGTERM', () => kafkaWrapper.disconnect());

  await new OrderCreatedListener().listen();
  console.log('expiration service running (Bull queue + Kafka)');
};

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
