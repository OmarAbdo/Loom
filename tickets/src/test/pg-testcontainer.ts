import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDb, AppDatabase } from '../db/db';
import { migrateToLatest } from '../db/migrator';

/**
 * Testcontainers harness: real Postgres in a throwaway container + migrations.
 * (Same approach as the auth service; chosen over pg-mem for fidelity — the OCC
 * behavior we test here depends on real row-level UPDATE ... WHERE semantics.)
 */
export interface PgHarness {
  db: AppDatabase;
  stop: () => Promise<void>;
  truncateAll: () => Promise<void>;
}

export async function startPgHarness(): Promise<PgHarness> {
  const container: StartedPostgreSqlContainer =
    await new PostgreSqlContainer('postgres:16').start();
  const db = createDb(container.getConnectionUri());
  await migrateToLatest(db);

  return {
    db,
    async stop() {
      await db.destroy();
      await container.stop();
    },
    async truncateAll() {
      await db.deleteFrom('tickets').execute();
    },
  };
}
