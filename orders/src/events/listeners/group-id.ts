/**
 * Kafka consumer group id for the orders service (competing consumers). All
 * orders replicas share it, so each event is handled once per service.
 */
export const groupId = 'orders-service';
