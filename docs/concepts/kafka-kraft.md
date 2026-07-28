# Concept: Kafka & KRaft

How the asynchronous backbone works, and how the concepts map onto what Grider's
NATS Streaming design assumed. Pitched for someone who has read the Kafka
whitepaper but wants the operational + client-side model concrete.

> Replaces NATS Streaming ([ADR-0001](../adr/0001-kafka-over-nats.md)). Serialization
> over Kafka is Avro via the Schema Registry — see
> [avro-and-schema-registry.md](avro-and-schema-registry.md).

---

## 1. The log, topics, and partitions

Kafka is a **distributed, append-only commit log**. Producers append records to
the end of a **topic**; consumers read forward at their own pace. Records are not
deleted on read — they age out by retention. This is the property the whitepaper
sells: the log is the source of truth, and consumers are just cursors over it.

A topic is split into **partitions**. A partition is the actual ordered log; a
topic is a logical bundle of partitions. Two consequences that matter to us:

- **Ordering is per-partition, not per-topic.** Records within one partition are
  strictly ordered by offset. Across partitions there is no order.
- **Parallelism is per-partition.** Within a consumer group, each partition is
  read by exactly one consumer — so a topic's max consumer parallelism equals its
  partition count.

Our topics are the `Subjects` values: `ticket:created`, `order:created`, etc.

## 2. Keys → ordering (the important design point)

Because ordering is per-partition, **how a record is assigned to a partition
determines what stays ordered.** Assignment is by **message key**: Kafka hashes
the key and all records with the same key go to the same partition.

We rely on per-entity ordering (an order's `created` must be seen before its
`cancelled`). So each publisher **keys on the aggregate id** (order id, ticket
id) via the `key(data)` override in the base `Publisher`. Result: all events
about one entity share a partition and are ordered relative to each other, even
though the topic as a whole is unordered.

> NATS Streaming gave per-channel ordering implicitly. In Kafka we *choose*
> per-entity ordering by keying. For a single-partition dev topic everything is
> trivially ordered; the keying is what keeps it correct once a topic is split
> into multiple partitions for throughput.

## 3. Consumer groups → competing consumers

A **consumer group** is a set of consumers sharing a `group.id`. Kafka assigns
each partition to one member, so the group as a whole processes each record
**once**. Add members → partitions redistribute (a rebalance).

This is the direct analog of a NATS **queue group**: replicas of a service share
a group id (`tickets`, `orders`, …), so scaling a service to N replicas splits
the partitions among them without double-processing. Each *service* is its own
group, so every interested service sees every event, but only once per service.

Group ids are set per service via `KAFKA_GROUP_ID` in the deployment and consumed
by the base `Listener`.

## 4. Offsets → "ack" and at-least-once

Each consumer group tracks, per partition, the **offset** of the next record to
read. Committing an offset is how a consumer says "I've durably handled up to
here."

Our base `Listener`:
- disables auto-commit,
- calls the handler, and
- commits `offset + 1` **only after** the handler calls `msg.ack()`.

If the handler throws or never acks, the offset is not committed, so on restart
Kafka **redelivers** from the last committed offset. That is **at-least-once**
delivery: no message is lost, but a message can be seen more than once (e.g. a
crash between handling and commit). Handlers must therefore be **idempotent** —
which the version-guarded writes provide (see
[optimistic-concurrency.md](optimistic-concurrency.md)).

> `msg.ack()` under NATS meant "don't redeliver." Under Kafka it means "commit
> this offset." We kept the method name so listeners barely change.

## 5. KRaft: Kafka without ZooKeeper

Historically Kafka needed **ZooKeeper** to store cluster metadata (topics,
partitions, leadership, ACLs) and to run leader election. **KRaft** (Kafka Raft)
replaces ZooKeeper with a **Raft consensus quorum built into Kafka itself**. The
metadata now lives in an internal Kafka log managed by **controller** nodes.

- A node's **role** is `broker` (serves data), `controller` (owns metadata + the
  Raft quorum), or — as in our single-node dev setup — **both** (`broker,controller`).
- The **controller quorum voters** list (`1@kafka-0.kafka-srv:9093`) is the Raft
  membership. With one node it is a quorum of one.
- No separate ZooKeeper pod, no second system to operate. This is the modern
  default and the reason ADR-0001 specifies "KRaft, no ZooKeeper."

> If you implemented Raft by hand, KRaft will feel familiar: the controllers run
> a Raft group whose replicated log *is* the cluster metadata. Broker leadership,
> topic creation, etc. become entries committed through that Raft log.

## 6. Listeners: the part that trips everyone up

A Kafka broker exposes **listeners** — named host:port endpoints with a security
protocol. The subtlety is **advertised listeners**: when a client bootstraps, the
broker replies with the address clients should actually connect to. If that
advertised address isn't reachable from the client, everything hangs *after* a
successful bootstrap.

In our cluster (see `infra/k8s/kafka-depl.yaml`):
- `PLAINTEXT://:9092` — bound inside the pod; advertised as
  `kafka-0.kafka-srv:9092` (the stable StatefulSet pod DNS) so services and the
  Schema Registry reach the broker at a name that resolves.
- `CONTROLLER://:9093` — the KRaft controller quorum listener, internal only.

Stable pod DNS (`kafka-0.kafka-srv`) comes from running Kafka as a **StatefulSet
behind a headless Service** — see [kubernetes-primitives.md](kubernetes-primitives.md).

## 7. Mental model

> Kafka is a partitioned append-only log. **Key** decides partition → decides what
> stays ordered. **Consumer group** = competing consumers = one-handle-per-service.
> **Offset commit** = ack = at-least-once (so be idempotent). **KRaft** runs the
> cluster's metadata through an internal Raft quorum instead of ZooKeeper.
> **Advertised listeners** must be an address the client can actually reach.
