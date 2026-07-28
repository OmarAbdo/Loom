import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  AvroDeserializer,
  SerdeType,
} from '@confluentinc/schemaregistry';
import { Subjects } from '@omarabdo/ticketing-schemas';
import { kafkaWrapper } from './kafka-wrapper';
import { Event } from './base-publisher';

/**
 * A thin message handle passed to `onMessage`, preserving the shape service
 * listeners were written against under NATS (which called `msg.ack()`).
 *
 * Under Kafka, "ack" means "commit this message's offset so it is not
 * redelivered." We expose an `ack()` that records intent; the base Consumer
 * performs the actual `commitOffsets` after `onMessage` resolves (see below).
 * Keeping this shape means Phase-5 listener bodies change almost not at all.
 */
export interface Message {
  /** Mark this message as successfully handled (commit its offset). */
  ack(): void;
  /** Raw underlying Kafka message, for listeners that need headers/metadata. */
  raw: KafkaJS.EachMessagePayload['message'];
}

/**
 * Base class for all event consumers (listeners).
 *
 * RESPONSIBILITIES
 * ----------------
 *  1. Join a consumer group (`groupId`) so replicas of a service compete for
 *     messages (one message handled once per service) — the Kafka analog of a
 *     NATS queue group.
 *  2. Subscribe to the topic named by `subject`.
 *  3. Avro-deserialize each message against the writer's schema (fetched from
 *     the registry by the schema id embedded in the message) reconciled with our
 *     reader's schema.
 *  4. Invoke the subclass `onMessage(data, msg)`.
 *  5. Commit the offset ONLY after `onMessage` resolves AND the listener called
 *     `msg.ack()` — giving at-least-once semantics with manual commit
 *     (ADR-0001). If `onMessage` throws or never acks, the offset is not
 *     committed and Kafka will redeliver.
 *
 * DELIVERY SEMANTICS
 * ------------------
 * We disable auto-commit and commit `offset + 1` (Kafka records "next offset to
 * read"). Because commit happens after successful handling, a crash mid-handle
 * leaves the offset uncommitted → the message is redelivered → handlers must be
 * idempotent. The version-guarded writes in the models provide that idempotency
 * (see docs/concepts/optimistic-concurrency.md).
 */
export abstract class Listener<T extends Event> {
  /** The topic to subscribe to. */
  abstract subject: T['subject'];
  /** The consumer group id (competing-consumers group). */
  abstract groupId: string;
  /** Handle one deserialized event. Call `msg.ack()` on success. */
  abstract onMessage(data: T['data'], msg: Message): Promise<void>;

  private consumer?: KafkaJS.Consumer;
  private deserializer?: AvroDeserializer;

  private getDeserializer(): AvroDeserializer {
    if (!this.deserializer) {
      this.deserializer = new AvroDeserializer(
        kafkaWrapper.registry,
        SerdeType.VALUE,
        {}
      );
    }
    return this.deserializer;
  }

  /**
   * Connect, subscribe, and begin consuming. Reads from the beginning so a
   * freshly-added consumer group replays history (matches the durable behavior
   * services assumed under NATS durable subscriptions).
   */
  async listen(): Promise<void> {
    this.consumer = kafkaWrapper.kafka.consumer({
      kafkaJS: {
        groupId: this.groupId,
        // Manual commit: we commit explicitly after successful handling.
        autoCommit: false,
        fromBeginning: true,
      },
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [this.subject] });

    this.consumer.run({
      eachMessage: async (payload: KafkaJS.EachMessagePayload) => {
        const { topic, partition, message } = payload;

        if (!message.value) {
          // Tombstone/empty — nothing to deserialize; commit past it.
          await this.commit(topic, partition, message.offset);
          return;
        }

        const data = (await this.getDeserializer().deserialize(
          this.subject,
          message.value
        )) as T['data'];

        let acked = false;
        const msg: Message = {
          ack: () => {
            acked = true;
          },
          raw: message,
        };

        console.log(`Message received: ${this.subject} / ${this.groupId}`);

        // If onMessage throws, we do NOT commit → Kafka redelivers.
        await this.onMessage(data, msg);

        // Commit only when the listener explicitly acked a successful handle.
        if (acked) {
          await this.commit(topic, partition, message.offset);
        }
      },
    });
  }

  /** Commit `offset + 1` (Kafka wants the next offset to read). */
  private async commit(topic: string, partition: number, offset: string): Promise<void> {
    await this.consumer!.commitOffsets([
      {
        topic,
        partition,
        offset: (parseInt(offset, 10) + 1).toString(),
      },
    ]);
  }

  /** Disconnect the consumer (graceful shutdown). */
  async close(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }
}
