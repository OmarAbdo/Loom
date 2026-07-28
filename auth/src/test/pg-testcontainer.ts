import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { createDb, AppDatabase } from '../db/db';
import { migrateToLatest } from '../db/migrator';

/**
 * Testcontainers harness: spins up a REAL Postgres in a throwaway container,
 * runs migrations, and hands back a connected Kysely instance. Chosen over an
 * in-memory fake (pg-mem) for full fidelity — same engine as production, real
 * constraint/uuid/OCC behavior (see phase4 decision / ADR-0003).
 *
 * Container startup is a few seconds; jest suites raise their timeout for the
 * beforeAll hook accordingly. One container per suite is reused across tests;
 * `truncateAll` gives each test a clean slate cheaply.
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
      // RESTART IDENTITY + CASCADE clears every table and resets sequences.
      await db.deleteFrom('users').execute();
    },
  };
}
