# ADR-0003 — Postgres per service (via Kysely), replacing MongoDB

**Status:** Accepted · **Date:** 2026-07-27

## Context

Grider uses **MongoDB** (via Mongoose) in every stateful service, one Mongo
instance per service. The domain data here is, however, strongly **relational and
schema-stable**: a ticket has fixed fields; an order references a ticket and a user;
a payment references an order. There are no document-shaped, schema-flexible
aggregates that would justify a document store.

Additional context:

- Omar is SQL-comfortable and has **not** used MongoDB; the learning value of this
  project is higher with Postgres.
- Grider's cross-service consistency relies on **optimistic concurrency control
  (OCC)** via a `version` field, implemented with the `mongoose-update-if-current`
  plugin. Any replacement must preserve this exactly (see
  `docs/concepts/optimistic-concurrency.md`).

## Decision

Use **PostgreSQL**, **one instance per service** (in-cluster StatefulSets),
accessed through **Kysely** — a typed SQL query builder.

### Why Postgres

- The data is relational with predictable schemas — the natural fit.
- The OCC `version` model maps *more cleanly* to SQL than to Mongo:
  `UPDATE ... SET ..., version = version + 1 WHERE id = $1 AND version = $2`,
  where a **0-row result signals a concurrency conflict**. This is precisely what
  `mongoose-update-if-current` does, expressed in plain SQL.
- Postgres scales far beyond anything this learning project will reach; the
  "Mongo scales horizontally more easily" concern is not decision-relevant here.

### Why one instance per service (not one shared DB)

This is the Newman-correct default: **a service owns its data**, and no other
service reaches into its tables. Independent schemas, independent failure domains,
independent scaling. The cost is more containers in the local cluster, which the
dev machine can absorb.

### Why Kysely (not an ORM like Prisma, not raw `pg`)

- **Typed, but close to SQL.** Kysely is a query *builder*: you write SQL-shaped
  queries and get full TypeScript inference over the result rows. This maximizes
  SQL learning (you see real queries) while keeping type safety.
- A heavyweight ORM (Prisma) would hide the SQL and add migration/runtime magic;
  raw `pg` would drop type safety and add boilerplate. Kysely is the middle path
  that fits Omar's "more SQL, less magic" preference.

## Consequences

- **Positive:** natural data model; cleaner OCC; strong SQL learning; typed access.
- **Migration work (Phase 4):** each Mongoose model becomes a table + a typed
  repository; each service gains a migrations folder; `mongodb-memory-server` in
  tests is replaced by an ephemeral Postgres (`pg-mem` or a throwaway container).
- **ID change:** Mongo `_id` / `toJSON` id-mapping goes away; Postgres uses a UUID
  `id` primary key. IDs still cross service boundaries via events unchanged.
- **`auth` too:** even auth moves to Postgres for consistency, though its data is
  trivial.
