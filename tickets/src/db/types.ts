import { Generated, ColumnType } from 'kysely';

/**
 * Kysely table interfaces for the tickets database.
 *
 * `version` is the optimistic-concurrency counter (see
 * docs/concepts/optimistic-concurrency.md). It defaults to 0 and is bumped on
 * every update via a version-guarded WHERE, replacing the Mongoose
 * `mongoose-update-if-current` plugin.
 */
export interface TicketsTable {
  id: Generated<string>;
  title: string;
  /** double precision to mirror the pre-migration money-as-number wire shape. */
  price: number;
  userId: string;
  /** uuid of the reserving order, or null when the ticket is free. */
  orderId: ColumnType<string | null, string | null | undefined, string | null>;
  /** OCC version; DB-defaulted to 0 on insert, then app-managed. */
  version: Generated<number>;
  createdAt: ColumnType<Date, never, never>;
}

export interface Database {
  tickets: TicketsTable;
}
