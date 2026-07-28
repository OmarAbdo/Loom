import { Kysely, sql } from 'kysely';

/**
 * Migration 001 — create the `tickets` table.
 *
 * - uuid `id` via gen_random_uuid() (replaces Mongo _id).
 * - `version` integer defaulting to 0 — the OCC counter.
 * - `order_id` nullable — set when reserved, null when free.
 * - `price` double precision — mirrors the pre-migration JS-number shape
 *   (money-as-double is a documented, deferred imprecision; see the .avsc docs).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tickets')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('price', 'double precision', (col) => col.notNull())
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('order_id', 'uuid')
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tickets').execute();
}
