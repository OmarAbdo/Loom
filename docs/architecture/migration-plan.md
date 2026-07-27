# Migration Plan

Tracks the refactor of the Grider ticketing project into the target architecture.
This document is the **source of truth** for the phased work — each phase is
independently reviewable and leaves the repo in a coherent state.

## Baseline (where we started)

- **From:** Stephen Grider's `482-dont-cancel` course checkpoint.
- Message broker: **NATS Streaming** (`node-nats-streaming` / STAN) — deprecated & EOL.
- Persistence: **MongoDB** via Mongoose in every service.
- Shared code: **`@rallycoding/common`** — a published npm package containing errors,
  middleware, the NATS base classes, **and every event's TypeScript interface**.
- Auth: JWT signed with a shared secret, stored in a cookie, verified per-service.
- `auth` had already been modernized by Omar (Express 5, Mongoose 8, TS 6, alpine,
  image prefix `456738/`, common code inlined) — this set the dependency baseline.

## Target (where we're going)

See the [ADRs](../adr/) for the *why* of each. In short: Kafka/KRaft + Avro/Schema
Registry + Postgres-per-service/Kysely + an infra-only shared package, keeping the
existing JWT auth.

## Phases

| # | Phase | Deliverable | Status |
| - | ----- | ----------- | ------ |
| 0 | **Scaffold** | All 6 services in the repo on the modern baseline layout; `nats-test` dropped; `skaffold.yaml` covers all services; `docs/` structure + foundational docs seeded. | ✅ done |
| 1 | **Schema Registry & Avro** | Registry running in-cluster; `.avsc` for all 6 events; codegen → TS types; compatibility mode set. | ⏳ next |
| 2 | **Infra-only `common`** | `@omarabdo/ticketing-common` trimmed to errors + middleware + Kafka base Publisher/Consumer + `kafka-wrapper`; developed via `npm link` until published. | ☐ |
| 3 | **Kafka (KRaft) in cluster** | `kafka-depl.yaml` StatefulSet (KRaft, no ZooKeeper); `nats-depl.yaml` deleted; service env → `KAFKA_*` + `SCHEMA_REGISTRY_URL`. | ☐ |
| 4 | **Postgres/Kysely per service** | Per-service Postgres StatefulSets replacing Mongo; Mongoose models → tables + typed Kysely repos preserving the OCC `version` contract; migrations; test setup on ephemeral Postgres. | ☐ |
| 5 | **Wire services** | Each service: imports → new common, delete `nats-wrapper`, Kafka+Avro publish/consume, Postgres wiring, Express 4→5. `expiration` keeps Bull+Redis (only its event edges move). | ☐ |
| 6 | **Saga documentation + smoke** | Purchase saga documented in Newman's terms; end-to-end flow verified via `skaffold dev`. | ☐ |
| 7 | **Testing pyramid** | Unit + integration + acceptance/e2e tests across services. | ☐ |
| 8 | **React client rebuild** | Next.js UI updated to fully drive the app (browse tickets, create, order, pay). | ☐ |

## Sequencing rationale

- **Contracts before code.** Phase 1 (schemas) and Phase 2 (base classes that
  serialize against those schemas) come before any service is rewired, so that
  when we touch a service (Phase 5) the transport it targets already exists and
  is typed.
- **Per-service dependency modernization is deferred to Phase 5**, not done in
  Phase 0. Bumping Express 4→5 *and* removing NATS/Mongo *and* swapping the common
  package are one coherent change per service — doing them together yields a
  single reviewable diff with a working end state, instead of a long-lived
  half-migrated tree. Consequence: the imported services do not build until their
  Phase 5 turn. That's acceptable — they aren't in the cluster yet.

## Known compromises carried forward (deliberate)

- **`version` does double duty** as the DB optimistic-concurrency lock *and* the
  inter-service event-ordering signal (`version - 1`). This is Grider's design.
  It's correct; we keep it but flag the seam. See
  [`docs/concepts/optimistic-concurrency.md`](../concepts/optimistic-concurrency.md).
- **Auth secret is verified in every service.** Newman would route this through a
  gateway / token service. Deferred — see [ADR-0005](../adr/0005-keep-jwt-auth.md).
