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
  // [Question] Do we always replay from the beginning? What if we want to only consume new messages? say in the case of a temporary service crash and we want to resume from where we left off? 
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

    /**
     * [Learning: single-core concurrency] `this.consumer.run()` registers an
     * async message loop. To understand why "concurrency on one core" isn't a
     * contradiction, three ideas have to click:
     *
     * 1. NodeJs is single-threaded for JS: one main thread runs one event loop.
     *    It never runs two pieces of my JS at once. Go uses goroutines scheduled
     *    across OS threads (true parallelism on multiple cores); Node does not.
     *
     * 2. "Async" does not mean "running on another thread." When run() waits for
     *    the Kafka broker, NO thread is blocked and NO thread is spinning. The
     *    socket is registered with the kernel's event mechanism (epoll on Linux)
     *    and the network card + kernel do the waiting passively — a hardware
     *    interrupt fires when bytes arrive. Waiting costs zero CPU.
     *    (Correction to an earlier guess: network I/O does NOT use libuv's
     *    thread pool. The pool is only for things with no async syscall — file
     *    I/O, DNS getaddrinfo, crypto/zlib. Sockets have async syscalls, so no
     *    pool thread is involved.)
     *
     * 3. The "switch back to sync" I was trying to picture isn't a switch at all.
     *    The event loop is: run all ready JS callbacks to completion → call
     *    epoll_wait (the ONE place the thread blocks) → for each ready socket,
     *    queue its callback → repeat. When Kafka's data arrives, epoll_wait
     *    returns, my eachMessage callback gets queued, and it runs on the SAME
     *    main thread on the next loop turn. No thread handoff, no context switch.
     *
     * So on a single core there's no illusion to resolve: only one thread ever
     * runs my code. Concurrency comes from the loop interleaving many callbacks,
     * while all the "waiting" lives in the kernel, not in blocked threads.
     *
     * SINGLE-THREADED (Node, Python) vs MULTI-THREADED (Go, Java): the former
     * interleave tasks on one thread via an event loop (concurrency, no
     * parallelism of user code); the latter can run tasks on multiple threads
     * across cores (real parallelism). On ONE core, both reduce to the OS
     * time-slicing — no physical difference. Multi-processing = running another
     * instance of the service in its own memory space (e.g. a second replica).
     */
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

        /**
         * Commit the offset ONLY when the listener explicitly acked.
         *
         * WHY AN `ack()` AT ALL — KAFKA-IDIOMATIC OR A NATS HOLDOVER?
         * ---------------------------------------------------------
         * It's a deliberate design choice, not Kafka idiom. Kafka has no
         * per-message "ack"; it tracks progress by committing offsets. We wrap
         * that in an explicit `ack()` so listeners keep the familiar interface
         * they had under NATS, and — more importantly — so a message counts as
         * handled only after the listener's own logic says so. That's what gives
         * us at-least-once delivery: nothing is committed until handling
         * succeeds, and redelivery on failure is safe because handlers are
         * idempotent (version-guarded writes).
         *
         * DOES THE BASE CLASS AUTO-ACK ON DESERIALIZE?
         * --------------------------------------------
         * No. Deserialization does not ack. The base class only *exposes*
         * `msg.ack()` via the Message interface; it never calls it. The listener
         * decides when — typically after its processing and validation complete
         * and it's confident the message was handled correctly. Control over the
         * commit point stays entirely with the listener.
         */
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
