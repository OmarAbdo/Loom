import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely';
import { Pool } from 'pg';
import { Database } from './types';

/**
 * Typed Kysely factory for the tickets database. Same pattern as the auth
 * service (a factory taking a connection string so service + tests share
 * construction). CamelCasePlugin maps camelCase <-> snake_case columns.
 */
export type AppDatabase = Kysely<Database>;

export function createDb(connectionString: string): AppDatabase {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
    plugins: [new CamelCasePlugin()],
  });
}
