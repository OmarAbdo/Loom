import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely';
import { Pool } from 'pg';
import { Database } from './types';

/** Typed Kysely factory for the payments database (see auth/tickets for pattern). */
export type AppDatabase = Kysely<Database>;

export function createDb(connectionString: string): AppDatabase {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
    plugins: [new CamelCasePlugin()],
  });
}
