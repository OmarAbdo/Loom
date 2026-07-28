# `@omarabdo/ticketing-common` — infra-only shared library

The shared **infrastructure** for every service: HTTP error types, Express
middleware, and the Kafka messaging mechanics. Per
[ADR-0004](../docs/adr/0004-infra-only-common.md) it contains **no domain or event
types** — those live in [`@omarabdo/ticketing-schemas`](../schemas/README.md).

Keeping the shared library domain-free is what prevents it from becoming a
distributed-monolith coupling point: changing an event never forces a lockstep
upgrade of this package.

## What's in here

```
src/
├── errors/          HTTP-mappable error types (CustomError + concrete 4xx/5xx)
├── middlewares/     Express: currentUser, requireAuth, validateRequest, errorHandler
└── events/
    ├── kafka-wrapper.ts     process-wide singleton: Kafka client + shared producer + registry
    ├── base-publisher.ts    Publisher<T>: Avro-serialize + produce (keyed for ordering)
    └── base-listener.ts     Listener<T>: consumer group + Avro-deserialize + manual commit
```

## The messaging mechanics

- **`kafkaWrapper`** — connect once at service startup
  (`kafkaWrapper.connect(clientId, brokers, schemaRegistryUrl)`), then everything
  shares its `producer` and `registry`.
- **`Publisher<T>`** — a subclass declares only its `subject` (topic) and,
  optionally, a `key(data)` for per-entity ordering. `publish(data)` Avro-encodes
  against the registry and produces. See ordering notes in
  [ADR-0001](../docs/adr/0001-kafka-over-nats.md).
- **`Listener<T>`** — a subclass declares `subject`, `groupId`, and
  `onMessage(data, msg)`. The base class joins the consumer group, deserializes,
  calls the handler, and commits the offset only after the handler calls
  `msg.ack()` — at-least-once with manual commit.

The `msg.ack()` shape is deliberately preserved from the NATS design so service
listeners barely change when rewired (Phase 5).

## Dependencies

- `@confluentinc/kafka-javascript` (promisified API) — Kafka client.
- `@confluentinc/schemaregistry` — Avro serdes.
- `@omarabdo/ticketing-schemas` (`file:../schemas` in dev) — `Subjects` type.
- `express` / `express-validator` are **peer** dependencies (each service brings
  its own; the middleware just types against them).

## Build

```bash
npm run build   # tsc -> ./build (this is the published artifact)
npm test        # unit tests for the base classes
```

During development, services depend on this package via a `file:` path (no
publish loop). A real `npm publish` happens once the package stabilizes.
