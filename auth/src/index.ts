import { app } from './app';
import { connectDb } from './db/connection';
import { migrateToLatest } from './db/migrator';

const start = async () => {
  const { JWT_KEY, DATABASE_URL } = process.env;
  if (!JWT_KEY) throw new Error('JWT_KEY must be defined');
  if (!DATABASE_URL) throw new Error('DATABASE_URL must be defined');

  try {
    const db = connectDb(DATABASE_URL);
    await migrateToLatest(db);
    console.log('Connected to Postgres and migrated');
  } catch (err) {
    console.error(err);
  }

  app.listen(3000, () => {
    console.log('auth service listening on port 3000');
  });
};

start();
