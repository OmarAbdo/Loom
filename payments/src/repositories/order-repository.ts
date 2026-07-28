import { AppDatabase } from '../db/db';

export type OrderStatus = 'created' | 'awaiting:payment' | 'complete' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  price: number;
  status: OrderStatus;
  version: number;
}

/**
 * Data-access for the payments service's LOCAL ORDER REPLICA. Replaces the
 * Mongoose `Order` model in payments, preserving:
 *   - build-with-producer-id+version (the order's id/version from the event),
 *   - `findByEvent({id, version})` = row at version - 1 (for order:cancelled),
 *   - version-guarded status update.
 */
export class OrderRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Insert a replica row using the producer's id + version (from order:created). */
  async create(attrs: {
    id: string;
    userId: string;
    price: number;
    status: OrderStatus;
    version: number;
  }): Promise<Order> {
    const row = await this.db
      .insertInto('orders')
      .values(attrs)
      .returning(['id', 'userId', 'price', 'status', 'version'])
      .executeTakeFirstOrThrow();
    return row as Order;
  }

  async findById(id: string): Promise<Order | undefined> {
    const row = await this.db
      .selectFrom('orders')
      .select(['id', 'userId', 'price', 'status', 'version'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row as Order | undefined;
  }

  /** The replica row an incoming order event may advance (version - 1). */
  async findByEvent(event: { id: string; version: number }): Promise<Order | undefined> {
    const row = await this.db
      .selectFrom('orders')
      .select(['id', 'userId', 'price', 'status', 'version'])
      .where('id', '=', event.id)
      .where('version', '=', event.version - 1)
      .executeTakeFirst();
    return row as Order | undefined;
  }

  /** Version-guarded status update (e.g. order:cancelled -> 'cancelled'). */
  async updateStatus(
    id: string,
    expectedVersion: number,
    status: OrderStatus,
    newVersion: number
  ): Promise<Order | undefined> {
    const row = await this.db
      .updateTable('orders')
      .set({ status, version: newVersion })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returning(['id', 'userId', 'price', 'status', 'version'])
      .executeTakeFirst();
    return row as Order | undefined;
  }
}
