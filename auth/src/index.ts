import { app } from './app';
import { connectDb } from './db/connection';
import { migrateToLatest } from './db/migrator';

const start = async () => {
  const { JWT_KEY, DATABASE_URL } = process.env;
  if (!JWT_KEY) throw new Error('JWT_KEY must be defined');
  if (!DATABASE_URL) throw new Error('DATABASE_URL must be defined');

  // Connect + migrate. If this fails (e.g. Postgres not yet ready), let the
  // error propagate so the process exits and Kubernetes restarts the pod — the
  // standard "crash until dependencies are ready" pattern. Do NOT swallow it and
  // start serving in a half-initialized state.
  const db = connectDb(DATABASE_URL);
  await migrateToLatest(db);
  console.log('Connected to Postgres and migrated');

  app.listen(3000, () => {
    console.log('auth service listening on port 3000');
  });
};

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
