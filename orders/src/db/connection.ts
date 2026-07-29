import { createDb, AppDatabase } from './db';

/**
 * Process-wide shared database handle (see tickets service for the rationale).
 */
let _db: AppDatabase | undefined;

export function connectDb(connectionString: string): AppDatabase {
  _db = createDb(connectionString);
  return _db;
}

export function getDb(): AppDatabase {
  if (!_db) {
    throw new Error('Database accessed before connectDb() was called');
  }
  return _db;
}
