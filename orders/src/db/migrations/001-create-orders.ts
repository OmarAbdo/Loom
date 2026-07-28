import { Kysely, sql } from 'kysely';

/**
 * Migration 001 — create the `tickets` replica and `orders` tables.
 *
 * `tickets` (replica): id is the ticket's own id (from ticket:created), so no
 * default — the app inserts the producer's id. Carries version for OCC on the
 * replica (ticket:updated events advance it).
 *
 * `orders`: uuid id (gen_random_uuid), status text, nullable expires_at, a FK
 * ticket_id into the replica, and a version OCC column.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tickets')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('price', 'double precision', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz')
    .addColumn('ticket_id', 'uuid', (col) =>
      col.notNull().references('tickets.id')
    )
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('orders').execute();
  await db.schema.dropTable('tickets').execute();
}
