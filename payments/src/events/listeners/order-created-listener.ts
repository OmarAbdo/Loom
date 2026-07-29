import { Listener, Message } from '@omarabdo/ticketing-common';
import { OrderCreatedEvent, Subjects } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { getDb } from '../../db/connection';
import { OrderRepository } from '../../repositories/order-repository';

/**
 * On order:created, insert the order into the local replica so a later charge
 * request can look it up (price, ownership, status) without calling orders.
 */
export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
  subject: Subjects.OrderCreated = Subjects.OrderCreated;
  groupId = groupId;

  async onMessage(data: OrderCreatedEvent['data'], msg: Message): Promise<void> {
    const orders = new OrderRepository(getDb());
    await orders.create({
      id: data.id,
      userId: data.userId,
      price: data.ticket.price,
      status: data.status,
      version: data.version,
    });
    msg.ack();
  }
}
