import { AppDatabase } from '../db/db';

export interface Payment {
  id: string;
  orderId: string;
  stripeId: string;
}

/**
 * Data-access for payments. Replaces the Mongoose `Payment` model. Payments are
 * write-once (no version / OCC) — created after a successful Stripe charge.
 */
export class PaymentRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: { orderId: string; stripeId: string }): Promise<Payment> {
    const row = await this.db
      .insertInto('payments')
      .values({ orderId: input.orderId, stripeId: input.stripeId })
      .returning(['id', 'orderId', 'stripeId'])
      .executeTakeFirstOrThrow();
    return row as Payment;
  }

  async findById(id: string): Promise<Payment | undefined> {
    const row = await this.db
      .selectFrom('payments')
      .select(['id', 'orderId', 'stripeId'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row as Payment | undefined;
  }
}
