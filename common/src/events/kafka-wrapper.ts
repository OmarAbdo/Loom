import { KafkaJS } from '@confluentinc/kafka-javascript';
import { SchemaRegistryClient } from '@confluentinc/schemaregistry';

const { Kafka } = KafkaJS;

/**
 * Process-wide singleton holding the shared Kafka connection resources.
 *
 * WHY A SINGLETON
 * ---------------
 * This mirrors the `nats-wrapper` singleton the services were built around: a
 * single object that owns the connection and is `connect()`-ed once at startup,
 * then imported wherever a producer/registry is needed. Keeping the shape
 * familiar minimizes churn when services are rewired (Phase 5).
 *
 * WHAT IT OWNS
 * ------------
 *  - `kafka`    — the client factory (makes producers/consumers).
 *  - `producer` — ONE shared producer for the whole process. Kafka producers are
 *                 thread-safe and meant to be long-lived and shared; creating one
 *                 per publish would be wasteful and hurt batching/ordering.
 *  - `registry` — the Schema Registry client the Avro serdes use.
 *
 * Consumers are NOT owned here: each `Consumer` subclass creates its own
 * consumer instance (its own group membership + subscription), so they are
 * constructed per-listener in the services, not centrally.
 *
 * We use the **promisified API** (`.KafkaJS` namespace) per ADR-0001.
 */
class KafkaWrapper {
  private _kafka?: KafkaJS.Kafka;
  private _producer?: KafkaJS.Producer;
  private _registry?: SchemaRegistryClient;

  /** The client factory. Throws if accessed before connect(). */
  get kafka(): KafkaJS.Kafka {
    if (!this._kafka) {
      throw new Error('Cannot access Kafka client before calling connect()');
    }
    return this._kafka;
  }

  /** The shared producer. Throws if accessed before connect(). */
  get producer(): KafkaJS.Producer {
    if (!this._producer) {
      throw new Error('Cannot access Kafka producer before calling connect()');
    }
    return this._producer;
  }

  /** The Schema Registry client. Throws if accessed before connect(). */
  get registry(): SchemaRegistryClient {
    if (!this._registry) {
      throw new Error('Cannot access Schema Registry client before calling connect()');
    }
    return this._registry;
  }

  /**
   * Establish the shared Kafka + Schema Registry connections. Call once at
   * service startup, before constructing any Publisher/Consumer.
   *
   * @param clientId          stable client id (services derive it from the pod name)
   * @param brokers           broker list, e.g. ['kafka-srv:9092']
   * @param schemaRegistryUrl base URL of the Schema Registry, e.g. http://schema-registry-srv:8081
   */
  async connect(
    clientId: string,
    brokers: string[],
    schemaRegistryUrl: string
  ): Promise<void> {
    this._kafka = new Kafka({
      kafkaJS: {
        clientId,
        brokers,
      },
    });

    this._registry = new SchemaRegistryClient({ baseURLs: [schemaRegistryUrl] });

    this._producer = this._kafka.producer();
    await this._producer.connect();

    console.log(`Connected to Kafka (brokers=${brokers.join(',')}) and Schema Registry (${schemaRegistryUrl})`);
  }

  /** Flush and close the shared producer. Call on graceful shutdown. */
  async disconnect(): Promise<void> {
    if (this._producer) {
      await this._producer.disconnect();
    }
  }
}

export const kafkaWrapper = new KafkaWrapper();
