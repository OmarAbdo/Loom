import { AppDatabase } from '../db/db';

/** A ticket as seen by the application. */
export interface Ticket {
  id: string;
  title: string;
  price: number;
  userId: string;
  orderId: string | null;
  version: number;
}

/** Fields settable when creating a ticket. */
export interface CreateTicketInput {
  title: string;
  price: number;
  userId: string;
}

/** Fields an update may change (title/price for edits; orderId for reserve/release). */
export interface UpdateTicketInput {
  title?: string;
  price?: number;
  orderId?: string | null;
}

/**
 * Optimistic-concurrency conflict: an update expected version N but the row was
 * not at N (someone else advanced it, or it vanished). Thrown by `update` so the
 * caller can decide to retry or surface an error — the SQL analog of what
 * `mongoose-update-if-current` did by throwing on a version mismatch.
 */
export class ConcurrencyError extends Error {
  constructor() {
    super('Ticket was modified concurrently (version mismatch)');
    Object.setPrototypeOf(this, ConcurrencyError.prototype);
  }
}

/**
 * Data-access for tickets. Replaces the Mongoose `Ticket` model, preserving:
 *   - OCC via a `version` column (bumped on every update),
 *   - `findByEvent({id, version})` = the row whose version is `version - 1`,
 *   - id/`_id` mapping is gone (Postgres uuid `id` is the natural key).
 *
 * See docs/concepts/optimistic-concurrency.md for the model this implements.
 */
export class TicketRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateTicketInput): Promise<Ticket> {
    const row = await this.db
      .insertInto('tickets')
      .values({
        title: input.title,
        price: input.price,
        userId: input.userId,
        // version defaults to 0, order_id defaults to null
      })
      .returning(['id', 'title', 'price', 'userId', 'orderId', 'version'])
      .executeTakeFirstOrThrow();
    return row as Ticket;
  }

  async findById(id: string): Promise<Ticket | undefined> {
    const row = await this.db
      .selectFrom('tickets')
      .select(['id', 'title', 'price', 'userId', 'orderId', 'version'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row as Ticket | undefined;
  }

  /**
   * Version-guarded update. Applies the change ONLY if the row is still at
   * `expectedVersion`, bumping version to `expectedVersion + 1`. A 0-row result
   * means a concurrency conflict → throws `ConcurrencyError`.
   *
   * This is the exact behavior of `mongoose-update-if-current`, expressed as an
   * explicit SQL guard (`WHERE id = ? AND version = ?`).
   */
  async update(
    id: string,
    expectedVersion: number,
    changes: UpdateTicketInput
  ): Promise<Ticket> {
    const row = await this.db
      .updateTable('tickets')
      .set({
        ...changes,
        version: expectedVersion + 1,
      })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returning(['id', 'title', 'price', 'userId', 'orderId', 'version'])
      .executeTakeFirst();

    if (!row) {
      throw new ConcurrencyError();
    }
    return row as Ticket;
  }

  /**
   * Find the ticket an incoming event may legally advance: the row whose current
   * version is exactly `event.version - 1`. Returns undefined if not found
   * (duplicate/out-of-order event) — the caller then leaves the message uncommitted
   * so Kafka redelivers. Mirrors the Mongoose `findByEvent` static.
   */
  async findByEvent(event: { id: string; version: number }): Promise<Ticket | undefined> {
    const row = await this.db
      .selectFrom('tickets')
      .select(['id', 'title', 'price', 'userId', 'orderId', 'version'])
      .where('id', '=', event.id)
      .where('version', '=', event.version - 1)
      .executeTakeFirst();
    return row as Ticket | undefined;
  }
}
