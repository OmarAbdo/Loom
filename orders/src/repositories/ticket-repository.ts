import { AppDatabase } from '../db/db';

/** The local ticket replica as seen by the orders service. */
export interface Ticket {
  id: string;
  title: string;
  price: number;
  version: number;
}

/** The order statuses that count as "actively holding" a ticket. */
const ACTIVE_ORDER_STATUSES = ['created', 'awaiting:payment', 'complete'];

/**
 * Data-access for the orders service's LOCAL TICKET REPLICA. Replaces the
 * Mongoose `Ticket` model in orders, preserving:
 *   - build-with-producer-id (the ticket's own id, from the event),
 *   - `findByEvent({id, version})` = row at version - 1,
 *   - `isReserved(ticketId)` = does an ACTIVE order already hold this ticket?
 *     (Mongoose did this as a document method; here it's an EXISTS query.)
 */
export class TicketRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Insert a replica row using the producer's id (from ticket:created). */
  async create(attrs: { id: string; title: string; price: number; version: number }): Promise<Ticket> {
    const row = await this.db
      .insertInto('tickets')
      .values(attrs)
      .returning(['id', 'title', 'price', 'version'])
      .executeTakeFirstOrThrow();
    return row as Ticket;
  }

  async findById(id: string): Promise<Ticket | undefined> {
    const row = await this.db
      .selectFrom('tickets')
      .select(['id', 'title', 'price', 'version'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row as Ticket | undefined;
  }

  /** The replica row an incoming ticket:updated may advance (version - 1). */
  async findByEvent(event: { id: string; version: number }): Promise<Ticket | undefined> {
    const row = await this.db
      .selectFrom('tickets')
      .select(['id', 'title', 'price', 'version'])
      .where('id', '=', event.id)
      .where('version', '=', event.version - 1)
      .executeTakeFirst();
    return row as Ticket | undefined;
  }

  /** Version-guarded replica update (from ticket:updated). */
  async updateFromEvent(
    id: string,
    expectedVersion: number,
    changes: { title: string; price: number; version: number }
  ): Promise<Ticket | undefined> {
    const row = await this.db
      .updateTable('tickets')
      .set({ title: changes.title, price: changes.price, version: changes.version })
      .where('id', '=', id)
      .where('version', '=', expectedVersion)
      .returning(['id', 'title', 'price', 'version'])
      .executeTakeFirst();
    return row as Ticket | undefined;
  }

  /**
   * Is this ticket already reserved by an ACTIVE order? True if any order for
   * this ticket is in created / awaiting:payment / complete. This is the
   * reservation guard the "new order" route uses to reject double-booking.
   */
  async isReserved(ticketId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('orders')
      .select('id')
      .where('ticketId', '=', ticketId)
      .where('status', 'in', ACTIVE_ORDER_STATUSES)
      .executeTakeFirst();
    return !!row;
  }
}
