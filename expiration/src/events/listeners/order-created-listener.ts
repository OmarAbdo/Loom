import { Listener, Message } from '@omarabdo/ticketing-common';
import { OrderCreatedEvent, Subjects } from '@omarabdo/ticketing-schemas';
import { groupId } from './group-id';
import { expirationQueue } from '../../queues/expiration-queue';

/**
 * On order:created, schedule a delayed Bull job to fire at the order's
 * expiresAt. When it fires, the queue publishes expiration:complete. Bull+Redis
 * is kept for delayed delivery (Kafka has no native delayed delivery, ADR-0001);
 * only the event edges use Kafka.
 */
export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
  subject: Subjects.OrderCreated = Subjects.OrderCreated;
  groupId = groupId;

  async onMessage(data: OrderCreatedEvent['data'], msg: Message): Promise<void> {
    const delay = new Date(data.expiresAt).getTime() - new Date().getTime();
    console.log('Scheduling expiration job in ms:', delay);

    await expirationQueue.add(
      { orderId: data.id },
      { delay: Math.max(delay, 0) }
    );

    msg.ack();
  }
}
