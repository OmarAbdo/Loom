import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDb, AppDatabase } from '../db/db';
import { migrateToLatest } from '../db/migrator';

/** Real-Postgres Testcontainers harness (see auth/tickets for rationale). */
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
      // payments FK -> orders, so delete payments first.
      await db.deleteFrom('payments').execute();
      await db.deleteFrom('orders').execute();
    },
  };
}
