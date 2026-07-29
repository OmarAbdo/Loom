import { app } from './app';
import { kafkaWrapper } from '@omarabdo/ticketing-common';
import { connectDb } from './db/connection';
import { migrateToLatest } from './db/migrator';
import { OrderCreatedListener } from './events/listeners/order-created-listener';
import { OrderCancelledListener } from './events/listeners/order-cancelled-listener';

const start = async () => {
  const {
    JWT_KEY,
    DATABASE_URL,
    KAFKA_BROKERS,
    KAFKA_CLIENT_ID,
    SCHEMA_REGISTRY_URL,
    STRIPE_KEY,
  } = process.env;
  if (!JWT_KEY) throw new Error('JWT_KEY must be defined');
  if (!DATABASE_URL) throw new Error('DATABASE_URL must be defined');
  if (!KAFKA_BROKERS) throw new Error('KAFKA_BROKERS must be defined');
  if (!KAFKA_CLIENT_ID) throw new Error('KAFKA_CLIENT_ID must be defined');
  if (!SCHEMA_REGISTRY_URL) throw new Error('SCHEMA_REGISTRY_URL must be defined');
  if (!STRIPE_KEY) throw new Error('STRIPE_KEY must be defined');

  try {
    await kafkaWrapper.connect(
      KAFKA_CLIENT_ID,
      KAFKA_BROKERS.split(','),
      SCHEMA_REGISTRY_URL
    );
    process.on('SIGINT', () => kafkaWrapper.disconnect());
    process.on('SIGTERM', () => kafkaWrapper.disconnect());

    const db = connectDb(DATABASE_URL);
    await migrateToLatest(db);
    console.log('Connected to Postgres and migrated');

    await new OrderCreatedListener().listen();
    await new OrderCancelledListener().listen();
  } catch (err) {
    console.error(err);
  }

  app.listen(3000, () => {
    console.log('payments service listening on port 3000');
  });
};

start();
