import { Generated, ColumnType } from 'kysely';

/**
 * Kysely table interfaces for the auth database.
 *
 * Each table interface describes the *column* types. Special wrappers:
 *   - `Generated<T>`   — the DB produces the value (e.g. a uuid default), so it
 *                        is optional on INSERT and always present on SELECT.
 *   - `ColumnType<S,I,U>` — distinct Select / Insert / Update types when they
 *                        differ (here: `created_at` is set by the DB default, so
 *                        it is never provided on insert/update).
 *
 * Column names are snake_case in Postgres; the CamelCasePlugin (see db.ts) lets
 * us use camelCase in TypeScript, so `createdAt` <-> `created_at` automatically.
 */
export interface UsersTable {
  /** uuid primary key, defaulted by the DB (gen_random_uuid()). */
  id: Generated<string>;
  email: string;
  /** scrypt hash in `hash.salt` form (see services/password.ts). */
  password: string;
  createdAt: ColumnType<Date, never, never>;
}

/** The full database schema: table name -> row interface. */
export interface Database {
  users: UsersTable;
}
