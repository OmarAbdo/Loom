# Ticketing — a Newman-aligned microservices reference

A marketplace where users list tickets for events and buy each other's tickets.
Originally the capstone project of an older learning course; this repository is a **deliberate refactor** of that project
to reflect the patterns in Sam Newman's _Building Microservices_ (2nd ed.) and to
use a modern, production-relevant stack.

---

## The system at a glance

Six services, each independently deployable, communicating **synchronously** over
REST (via an NGINX ingress) and **asynchronously** over **Apache Kafka**.

| Service      | Responsibility                                    | Data store         |
| ------------ | ------------------------------------------------- | ------------------ |
| `auth`       | User accounts, signup/signin, JWT issuance        | Postgres           |
| `tickets`    | Create / list / update tickets                    | Postgres           |
| `orders`     | Order lifecycle; **initiates the purchase saga**  | Postgres           |
| `expiration` | Delayed job: expire unpaid orders after a timeout | Redis (Bull queue) |
| `payments`   | Stripe charge; records payments                   | Postgres           |
| `client`     | Vite + React + TypeScript SPA (nginx)             | —                  |

Cross-service **events** (`ticket:created`, `order:created`, …) are Kafka topics.
Their **contracts are Avro schemas** held in a Confluent Schema Registry — not
TypeScript interfaces shared between services (see
[ADR-0002](docs/adr/0002-avro-schema-registry.md)).

---

## Stack

| Concern            | Choice                                                  | Rationale (ADR)                                   |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| Orchestration      | Kubernetes (Docker Desktop, local)                      | —                                                 |
| Async messaging    | **Apache Kafka in KRaft mode** (no ZooKeeper)           | [ADR-0001](docs/adr/0001-kafka-over-nats.md)      |
| Kafka client       | `@confluentinc/kafka-javascript` (native API)           | [ADR-0001](docs/adr/0001-kafka-over-nats.md)      |
| Event contracts    | Avro + Confluent Schema Registry                        | [ADR-0002](docs/adr/0002-avro-schema-registry.md) |
| Persistence        | Postgres per service, via Kysely                        | [ADR-0003](docs/adr/0003-postgres-per-service.md) |
| Shared code        | **Infra-only** npm package `@omarabdo/ticketing-common` | [ADR-0004](docs/adr/0004-infra-only-common.md)    |
| Auth               | JWT-in-cookie                                           | [ADR-0005](docs/adr/0005-keep-jwt-auth.md)        |
| Language / runtime | TypeScript 6, Node (alpine), Express 5                  | —                                                 |

---

## How to read this documentation

Documentation is a **first-class deliverable** of this project — it is written to
teach the concepts, not merely to record them. Start here and follow the links:

```
docs/
├── adr/            Architecture Decision Records — WHY each major choice was made
├── architecture/   System-wide views: topology, event flow, the purchase saga
├── concepts/       Deep dives on the technologies (Kafka/KRaft, Avro, OCC, k8s…)
└── services/       One page per service: its API, events, data model, tests
```

Suggested reading order for someone new to the system:

1. [`docs/architecture/overview.md`](docs/architecture/overview.md) — the big picture
2. The ADRs in order — the decisions and their tradeoffs
3. [`docs/concepts/`](docs/concepts/) — whichever technology you want to understand
4. The per-service pages as you touch each service

---

## Running it locally

> Prerequisites: Docker Desktop with Kubernetes enabled.

```bash
# one-time: point the ingress host at localhost
# (add to your hosts file)  127.0.0.1  ticketing.dev

skaffold dev            # builds all images, deploys the cluster, streams logs
```

Then open `https://ticketing.dev` (accept the self-signed cert warning).

Full setup — secrets, hosts file, ingress-nginx install — is documented in
[`docs/architecture/local-setup.md`](docs/architecture/local-setup.md).

---

## Migration status

This repo is mid-migration from the old course's baseline. Progress and the phase plan
live in [`docs/architecture/migration-plan.md`](docs/architecture/migration-plan.md).
