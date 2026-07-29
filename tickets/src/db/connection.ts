import { createDb, AppDatabase } from './db';

/**
 * Process-wide shared database handle.
 *
 * Mirrors the kafkaWrapper singleton pattern: `connect()` once at startup in
 * index.ts, then `getDb()` anywhere (routes, listeners) to build a repository.
 * Keeping a single Kysely instance (one pg Pool) per process is correct — the
 * pool multiplexes connections; creating a Kysely per request would leak pools.
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
