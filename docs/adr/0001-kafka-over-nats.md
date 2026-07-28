# ADR-0001 — Replace NATS Streaming with Apache Kafka (KRaft)

**Status:** Accepted · **Date:** 2026-07-27

## Context

Grider's project uses **NATS Streaming** (the `node-nats-streaming` / "STAN"
client) as its event backbone. NATS Streaming is **deprecated and end-of-life** —
it was superseded by NATS JetStream years ago and receives no further development.
Building a reference project on an EOL broker teaches patterns against an artifact
you'd never deploy.

Two properties of Grider's design that any replacement must preserve:

1. **Competing consumers / queue groups.** Multiple replicas of a service form a
   group; each message is processed by exactly one replica in the group. This is
   how the system scales a consumer horizontally without double-processing.
2. **Per-entity ordering + at-least-once delivery with manual ack.** A consumer
   acks a message only after it has durably handled it; unacked messages are
   redelivered. Ordering of events *about the same entity* matters (an
   `order:created` must be seen before its `order:cancelled`).

## Decision

Migrate to **Apache Kafka**, run in **KRaft mode** (Kafka Raft — the built-in
consensus layer that replaces ZooKeeper). Use the **`@confluentinc/kafka-javascript`**
client and program against its **native API**.

### Why Kafka

- Kafka's **consumer groups** are a direct, more powerful analog of NATS queue
  groups — same competing-consumers semantics, plus partition-level parallelism.
- **Per-partition ordering** gives us the ordering guarantee we need: we key each
  message by its aggregate id (ticket id, order id) so all events about one entity
  land on the same partition and are therefore ordered. (NATS gave per-channel
  ordering "for free"; in Kafka ordering is per-partition and we achieve
  per-entity ordering via the message key. This is a *concept to understand*, not
  a limitation — see `docs/concepts/kafka-kraft.md`.)
- **Offset commits** replace `msg.ack()`. Committing an offset after successful
  processing preserves the at-least-once + redelivery behavior the listeners
  assume.
- Kafka is the industry-standard event log and the one Omar has already studied
  (read the Kafka whitepaper) — maximal learning transfer.

### Why KRaft (no ZooKeeper)

ZooKeeper was Kafka's external metadata/consensus store. **KRaft** folds that into
Kafka itself using a Raft quorum, so a modern Kafka deployment is a single system,
not two. Since the goal is *latest* Kafka and a lean local cluster, KRaft is both
the current default and one fewer moving part.

### Why the Confluent client — and which of its two APIs

- **KafkaJS** (the standalone library) was the long-time community client but is
  **unmaintained** (no release since Feb 2023). We are not using that library.
- **`@confluentinc/kafka-javascript`** is Confluent's official, actively
  maintained client (a wrapper over the battle-tested C library `librdkafka`).
- The Confluent client exposes *two* API styles on top of the same librdkafka
  core:
  1. a **callback API** (node-rdkafka-style: `producer.produce(...)`,
     event-driven `consumer.on('data')`, `consumer.commit(m)`), and
  2. a **promisified API** (`producer.send({...})`,
     `consumer.run({ eachMessage })`, `await consumer.commitOffsets([...])`).
- **We use the promisified API.** Confluent explicitly **recommends the
  promisified API for new projects** — it is their idiomatic, ergonomic surface,
  and its `async eachMessage` + `commitOffsets` shape maps directly onto our base
  Consumer's "handle then manually commit" need. The callback API would force
  awkward event-plumbing into the base class for no benefit.

> **Naming caution (corrected from an earlier draft of this ADR):** the
> promisified API is *shaped like* KafkaJS and is reached via the client's
> `.KafkaJS` namespace, so it's easy to conflate "use the promisified API" with
> "use a legacy-compat shim." They are not the same. The promisified API is the
> **recommended interface for greenfield code**, not a migration-only shim. What
> we are *not* doing is depending on the standalone, unmaintained `kafkajs`
> package. We configure the client with librdkafka config keys throughout.

## Consequences

- **Positive:** maintained client; industry-standard broker; stronger ordering &
  parallelism model; KRaft removes ZooKeeper.
- **Cost:** `@confluentinc/kafka-javascript` is a **native addon** (librdkafka).
  Its Docker build needs build toolchain/glibc; alpine + musl may require switching
  affected images to a glibc base (e.g. `node:slim`). Tracked in Phase 5.
- **Cost:** the `msg.ack()` → offset-commit change is the subtlest part of the
  port; done once in the shared base Consumer (Phase 2) so services don't repeat it.
- **Follow-on:** ordering now depends on choosing a good message **key**. Documented
  per-event in `docs/concepts/kafka-kraft.md`.

## References

- Base classes that encapsulate this: `common` package (Phase 2).
- Cluster manifest: `infra/k8s/kafka-depl.yaml` (Phase 3).
