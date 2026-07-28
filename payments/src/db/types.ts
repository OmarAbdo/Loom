import { Generated, ColumnType } from 'kysely';

/**
 * Kysely table interfaces for the payments database.
 *
 * The payments service owns TWO tables:
 *   - `orders`   — a LOCAL REPLICA of orders (only the fields payments needs:
 *                  id/version/userId/price/status), populated by consuming
 *                  order:created / order:cancelled. The replica keeps the
 *                  PRODUCER's id + version (not DB-generated).
 *   - `payments` — the payment records this service creates. No version column
 *                  (payments are immutable once written; nothing does OCC on them).
 */
export interface OrdersReplicaTable {
  /** The order's id from the orders service (NOT DB-generated). */
  id: string;
  userId: string;
  price: number;
  status: string;
  version: number;
}

export interface PaymentsTable {
  id: Generated<string>;
  orderId: string;
  stripeId: string;
  createdAt: ColumnType<Date, never, never>;
}

export interface Database {
  orders: OrdersReplicaTable;
  payments: PaymentsTable;
}
