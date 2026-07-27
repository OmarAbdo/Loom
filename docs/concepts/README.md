# Concepts

Deep dives on the technologies and patterns in this system. Each is written to
*teach* the concept and tie it to how this project uses it.

| Concept | Status | Lands in |
| ------- | ------ | -------- |
| [Optimistic Concurrency & the `version` field](optimistic-concurrency.md) | ✅ written | Phase 0 |
| Kafka & KRaft (topics, partitions, consumer groups, keys, offsets) | ☐ planned | Phase 3 |
| Avro & the Schema Registry (wire format, compatibility, tolerant reader) | ☐ planned | Phase 1 |
| Kubernetes primitives used here (Deployment vs StatefulSet, Service, Ingress, Secret) | ☐ planned | Phase 3–4 |
| Choreographed sagas & compensating actions | ☐ planned | Phase 6 |

Concept docs are written **when the corresponding code is built**, so they describe
the real implementation rather than a plan.
