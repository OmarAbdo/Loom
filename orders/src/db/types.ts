import { Generated, ColumnType } from 'kysely';

/**
 * Kysely table interfaces for the orders database.
 *
 * The orders service owns TWO tables:
 *   - `orders`  — the orders it creates (source of truth for order state).
 *   - `tickets` — a LOCAL REPLICA of tickets, populated by consuming
 *                 ticket:created / ticket:updated. Lets orders decide "is this
 *                 ticket reservable?" without a synchronous call to the tickets
 *                 service (see docs/architecture/overview.md, data-replication).
 *
 * Both carry a `version` OCC column. The replica's id is the PRODUCER's id (the
 * ticket's id from the event), not DB-generated — so `id` is a plain string,
 * not Generated.
 */
export interface OrdersTable {
  id: Generated<string>;
  userId: string;
  /** Order status string, e.g. 'created' | 'awaiting:payment' | 'complete' | 'cancelled'. */
  status: string;
  /** Reservation expiry; nullable to mirror the original schema. */
  expiresAt: ColumnType<Date | null, Date | string | null, Date | string | null>;
  /** FK to the local tickets replica. */
  ticketId: string;
  version: Generated<number>;
  createdAt: ColumnType<Date, never, never>;
}

export interface TicketsReplicaTable {
  /** The ticket's id as produced by the tickets service (NOT DB-generated). */
  id: string;
  title: string;
  price: number;
  version: number;
}

export interface Database {
  orders: OrdersTable;
  tickets: TicketsReplicaTable;
}
