import { Listener, Message } from '@omarabdo/ticketing-common';
import { Subjects, ExpirationCompleteEvent } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { OrderRepository } from '../../repositories/order-repository';
import { OrderCancelledPublisher } from '../publishers/order-cancelled-publisher';

/**
 * On expiration:complete, cancel the order IF it has not already been paid
 * (status !== complete) — the saga's compensating action. Then publish
 * order:cancelled so tickets/payments react. This is the "don't cancel a paid
 * order" rule (the 482-dont-cancel course chapter).
 */
export class ExpirationCompleteListener extends Listener<ExpirationCompleteEvent> {
  subject: Subjects.ExpirationComplete = Subjects.ExpirationComplete;
  groupId = groupId;

  async onMessage(data: ExpirationCompleteEvent['data'], msg: Message): Promise<void> {
    const orders = new OrderRepository(getDb());

    const order = await orders.findById(data.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Already paid → do nothing (do NOT cancel a completed order).
    if (order.status === 'complete') {
      return msg.ack();
    }

    const cancelled = await orders.updateStatus(order.id, order.version, 'cancelled');

    await new OrderCancelledPublisher().publish({
      id: cancelled.id,
      version: cancelled.version,
      ticket: { id: cancelled.ticketId },
    });

    msg.ack();
  }
}
