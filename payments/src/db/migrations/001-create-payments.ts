import { Kysely, sql } from 'kysely';

/**
 * Migration 001 — create the `orders` replica and `payments` tables.
 *
 * `orders` (replica): id is the order's own id (from order:created); version for
 * OCC on the replica. `payments`: uuid id (gen_random_uuid), FK order_id into
 * the replica, stripe_id for reconciliation. No version on payments (immutable).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('price', 'double precision', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('payments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('order_id', 'uuid', (col) => col.notNull().references('orders.id'))
    .addColumn('stripe_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('payments').execute();
  await db.schema.dropTable('orders').execute();
}
