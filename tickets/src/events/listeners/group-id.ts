/**
 * Kafka consumer group id for the tickets service. All replicas of tickets
 * share this group, so each event is handled once per service (competing
 * consumers) — the Kafka analog of the old NATS queue group.
 */
export const groupId = 'tickets-service';
