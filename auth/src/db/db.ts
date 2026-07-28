import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely';
import { Pool } from 'pg';
import { Database } from './types';

/**
 * Build a typed Kysely instance for the auth database.
 *
 * WHY A FACTORY (not a module-level singleton)
 * --------------------------------------------
 * Tests need to point Kysely at a throwaway Testcontainers Postgres, while the
 * running service points at the in-cluster Postgres. A factory taking a
 * connection string lets both share the exact same construction. The service
 * builds one instance at startup (Phase 5 wiring); tests build one per suite.
 *
 * CamelCasePlugin maps camelCase (TS) <-> snake_case (Postgres) automatically.
 */
export type AppDatabase = Kysely<Database>;

export function createDb(connectionString: string): AppDatabase {
  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString }),
  });

  return new Kysely<Database>({
    dialect,
    plugins: [new CamelCasePlugin()],
  });
}
