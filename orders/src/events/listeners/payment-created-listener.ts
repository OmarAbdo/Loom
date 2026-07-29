import { Listener, Message } from '@omarabdo/ticketing-common';
import { Subjects, PaymentCreatedEvent } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { OrderRepository } from '../../repositories/order-repository';

/**
 * On payment:created, mark the order Complete — the saga's success terminal
 * state. A completed order can no longer be cancelled by expiration.
 */
export class PaymentCreatedListener extends Listener<PaymentCreatedEvent> {
  subject: Subjects.PaymentCreated = Subjects.PaymentCreated;
  groupId = groupId;

  async onMessage(data: PaymentCreatedEvent['data'], msg: Message): Promise<void> {
    const orders = new OrderRepository(getDb());

    const order = await orders.findById(data.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    await orders.updateStatus(order.id, order.version, 'complete');
    msg.ack();
  }
}
