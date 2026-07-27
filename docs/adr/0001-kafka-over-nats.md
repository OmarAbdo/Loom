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

### Why the Confluent client (native API), not KafkaJS

- **KafkaJS** was the long-time community client but is **unmaintained** (no
  release since Feb 2023).
- **`@confluentinc/kafka-javascript`** is Confluent's official, actively
  maintained client (a wrapper over the battle-tested C library `librdkafka`).
- The Confluent client exposes *two* APIs: its own native API, and a
  "KafkaJS-compatible" shim intended to let **existing** KafkaJS codebases migrate
  without a rewrite. **We start fresh, so we use the native API** — the compat
  shim solves a problem (legacy KafkaJS code) we don't have. It's mentioned only
  because tutorials and search results reference KafkaJS heavily; we are
  deliberately not using it.

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
