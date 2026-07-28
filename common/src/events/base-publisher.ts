import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  AvroSerializer,
  SerdeType,
} from '@confluentinc/schemaregistry';
import { Subjects } from '@omarabdo/ticketing-schemas';
import { kafkaWrapper } from './kafka-wrapper';

/**
 * The minimal shape every event type satisfies: a `subject` (the Kafka topic /
 * discriminant) and a `data` payload. Concrete event contracts live in
 * @omarabdo/ticketing-schemas; this is only the structural bound.
 */
export interface Event {
  subject: Subjects;
  data: any;
}

/**
 * Base class for all event publishers.
 *
 * RESPONSIBILITIES
 * ----------------
 *  1. Avro-serialize `data` against the topic's registered schema (via the
 *     Schema Registry) — services never touch serialization.
 *  2. Produce the message to the topic named by `subject`.
 *  3. Key the message so per-entity ordering holds (see below).
 *
 * ORDERING (ADR-0001)
 * -------------------
 * Kafka guarantees ordering only *within a partition*. To preserve the
 * per-entity ordering the system relies on (e.g. an order's `created` before its
 * `cancelled`), we key each message by its aggregate id via `key(data)`. All
 * messages sharing a key land on the same partition and are therefore ordered
 * relative to each other. Subclasses override `key()` to return the right id
 * (default: undefined = round-robin, only safe for events with no ordering
 * requirement).
 *
 * A subclass only declares its `subject`; everything else is inherited.
 */
export abstract class Publisher<T extends Event> {
  abstract subject: T['subject'];

  /** Lazily-built Avro serializer for this publisher's topic. */
  private serializer?: AvroSerializer;

  /**
   * Partition key for an event, for per-entity ordering. Override to return the
   * aggregate id (e.g. `data.id`). Default `undefined` = no key (round-robin);
   * only appropriate when ordering across events does not matter.
   */
  protected key(data: T['data']): string | undefined {
    return undefined;
  }

  private getSerializer(): AvroSerializer {
    if (!this.serializer) {
      // VALUE serdes: serialize the message value (not the key). `useLatestVersion`
      // makes the serializer use the latest registered schema for the subject.
      this.serializer = new AvroSerializer(
        kafkaWrapper.registry,
        SerdeType.VALUE,
        { useLatestVersion: true }
      );
    }
    return this.serializer;
  }

  /**
   * Serialize and publish an event. Resolves once the broker acknowledges the
   * message (the shared producer's `send` awaits delivery).
   */
  async publish(data: T['data']): Promise<void> {
    const value = await this.getSerializer().serialize(this.subject, data);
    const key = this.key(data);

    const message: KafkaJS.Message = { value };
    if (key !== undefined) {
      message.key = key;
    }

    await kafkaWrapper.producer.send({
      topic: this.subject,
      messages: [message],
    });

    console.log(`Event published to topic ${this.subject}`);
  }
}
