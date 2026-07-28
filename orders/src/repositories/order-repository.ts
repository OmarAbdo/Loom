import { AppDatabase } from '../db/db';

/** OrderStatus values (kept as string literals to avoid a cross-service type import). */
export type OrderStatus = 'created' | 'awaiting:payment' | 'complete' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  expiresAt: Date | null;
  ticketId: string;
  version: number;
}

export class ConcurrencyError extends Error {
  constructor() {
    super('Order was modified concurrently (version mismatch)');
    Object.setPrototypeOf(this, ConcurrencyError.prototype);
  }
}

/**
 * Data-access for orders. Replaces the Mongoose `Order` model, preserving OCC
 * via a `version` column. The order is the source of truth for its own state;
 * status transitions (created -> awaiting:payment/complete/cancelled) are the
 * saga's steps (see docs/architecture/saga.md, Phase 6).
 */
export class OrderRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    userId: string;
    status: OrderStatus;
    expiresAt: Date;
    ticketId: string;
  }): Promise<Order> {
    const row = await this.db
      .insertInto('orders')
      .values({
        userId: input.userId,
        status: input.status,
        expiresAt: input.expiresAt,
        ticketId: input.ticketId,
      })
      .returning(['id', 'userId', 'status', 'expiresAt', 'ticketId', 'version'])
      .executeTakeFirstOrThrow();
    return row as Order;
  }

  async findById(id: string): Promise<Order | undefined> {
    const row = await this.db
      .selectFrom('orders')
      .select(['id', 'userId', 'status', 'expiresAt', 'ticketId', 'version'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row as Order | undefined;
  }

  async findByUser(userId: string): Promise<Order[]> {
    const rows = await this.db
      .selectFrom('orders')
      .select(['id', 'userId', 'status', 'expiresAt', 'ticketId', 'version'])
      .where('userId', '=', userId)
      .execute();
    return rows as Order[];
  }

  /**
   * Version-guarded status change. Applies only if the row is at
   * `expectedVersion`; bumps to `expectedVersion + 1`. 0 rows -> ConcurrencyError.
   * Used to move an order to awaiting:payment / complete / cancelled.
   */
  async updateStatus(
    id: string,
    expectedVersion: number,
    status: OrderStatus
  ): Promise<Order> {
    const row = await this.db
      .updateTable('orders')
      .set({ status, version: expectedVersion + 1 })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returning(['id', 'userId', 'status', 'expiresAt', 'ticketId', 'version'])
      .executeTakeFirst();
    if (!row) throw new ConcurrencyError();
    return row as Order;
  }
}
