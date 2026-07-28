import { Kysely, sql } from 'kysely';

/**
 * Migration 001 — create the `users` table.
 *
 * - `id` is a uuid defaulted by Postgres via gen_random_uuid() (built into PG 13+),
 *   replacing Mongo's ObjectId `_id`.
 * - `email` is unique (auth rejects duplicate signups).
 * - `password` stores the scrypt `hash.salt` string.
 *
 * Note: migration bodies use `Kysely<any>` because the schema they *build* does
 * not yet exist as a typed interface at migration time.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
