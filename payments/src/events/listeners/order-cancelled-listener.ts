import { Listener, Message } from '@omarabdo/ticketing-common';
import { OrderCancelledEvent, Subjects } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { OrderRepository } from '../../repositories/order-repository';

/**
 * On order:cancelled, mark the local order replica cancelled (via findByEvent
 * for ordering) so a late charge request is rejected. If the predecessor
 * version isn't present, do not ack → Kafka redelivers.
 */
export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
  subject: Subjects.OrderCancelled = Subjects.OrderCancelled;
  groupId = groupId;

  async onMessage(data: OrderCancelledEvent['data'], msg: Message): Promise<void> {
    const orders = new OrderRepository(getDb());

    const order = await orders.findByEvent(data);
    if (!order) {
      throw new Error('Order not found (out-of-order or duplicate event)');
    }

    await orders.updateStatus(order.id, order.version, 'cancelled', data.version);
    msg.ack();
  }
}
