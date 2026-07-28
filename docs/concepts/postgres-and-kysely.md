# Concept: Postgres & Kysely (the data layer)

How persistence works after the move off MongoDB
([ADR-0003](../adr/0003-postgres-per-service.md)). Focus is the *shape* of the
data layer and the patterns every service follows, so any one service's `db/` +
`repositories/` reads the same way.

## Why this shape

Grider's services used Mongoose models that mixed schema, query logic, OCC, and
JSON-shaping into one object. We split those concerns:

```
src/
├── db/
│   ├── types.ts        Kysely table interfaces (the schema, in TypeScript)
│   ├── db.ts           createDb(connectionString) -> typed Kysely instance
│   ├── migrator.ts     runs migrations (static provider)
│   └── migrations/     one file per migration (up/down)
└── repositories/       one repo per aggregate; all SQL lives here
```

- **Repositories** are the only place SQL is written. Routes/listeners call
  repo methods, never the query builder directly. This keeps persistence
  swappable and testable in isolation.
- **A `createDb(connectionString)` factory** (not a global singleton) lets the
  service point at the cluster Postgres while tests point at a throwaway
  Testcontainers Postgres — same construction, different URL.

## Kysely in 60 seconds

Kysely is a **typed SQL query builder** — you write SQL-shaped queries and get
full TypeScript inference over the result rows, from the table interfaces in
`db/types.ts`. It is not an ORM: there are no lazy-loaded entities or hidden
queries; every call maps to obvious SQL. Chosen for exactly that transparency
([ADR-0003](../adr/0003-postgres-per-service.md)).

Two conventions we use everywhere:

- **`CamelCasePlugin`** maps TS `camelCase` to Postgres `snake_case`, so
  `orderId` in code is `order_id` in the DB automatically.
- **`Generated<T>`** marks DB-produced columns (a `uuid` default, the `version`
  default) so they are optional on insert and always present on select.

## IDs: uuid, not ObjectId

Mongo's `_id` (ObjectId) is gone. Primary keys are Postgres `uuid` with a
`gen_random_uuid()` default (built into Postgres 13+). Two flavors:

- **Owned rows** (a service's own aggregate) get a DB-generated uuid.
- **Replica rows** (a copy of another service's data — orders' ticket replica,
  payments' order replica) keep the **producer's id** (supplied from the event),
  so ids match across services. These columns have no default; the app inserts
  the id it received.

## Optimistic concurrency, in SQL

The `version` column and its guarded update are the heart of the data layer.
Full treatment is in [optimistic-concurrency.md](optimistic-concurrency.md); the
SQL shape:

```sql
UPDATE tickets
   SET price = $1, version = $2      -- $2 = expectedVersion + 1
 WHERE id = $3 AND version = $4;     -- $4 = expectedVersion
```

A **0-row result means a concurrency conflict** — the repo throws
`ConcurrencyError` (or returns `undefined` for replica updates driven by events).
This is `mongoose-update-if-current`, made explicit. `findByEvent({id, version})`
is `WHERE id = $1 AND version = $2 - 1` — the row an incoming event may legally
advance.

## Migrations

Each service has `db/migrations/NNN-*.ts` files exporting `up`/`down`, run by a
`migrator.ts` that uses a **static (in-code) migration provider** — it imports
each migration module explicitly rather than globbing the filesystem, which is
robust under ts-node/jest/the built image alike. `migrateToLatest(db)` runs at
service startup and in test setup.

## Testing: real Postgres via Testcontainers

Data-layer tests run against a **real Postgres in a throwaway container**
(`@testcontainers/postgresql`), not an in-memory fake. Rationale: this is a
DB-focused learning project and pg-mem has fidelity gaps (it treats all numeric
types as JS numbers and has partial SQL coverage) that could hide or invent bugs.
Real Postgres already earned its keep here — it caught a uuid-vs-placeholder bug
that a fake would have silently accepted, and it's what makes the
"two concurrent writers, exactly one wins" OCC test meaningful (real row-level
locking).

Each service has a `jest.db.config.js` that runs only the repo tests (no Mongo
setup, no Express app) and a `test/pg-testcontainer.ts` harness that starts the
container, migrates, and hands back a connected Kysely instance.

> Cost: a container start (~seconds) per suite, and Docker must be running.
> Accepted for fidelity. Faster unit tests could still mock the repo interface
> where the DB isn't the thing under test.

## Per-service data model summary

| Service | Owned tables | Replica tables | OCC? |
| ------- | ------------ | -------------- | ---- |
| auth     | `users`     | —                     | no (no cross-service events) |
| tickets  | `tickets`   | —                     | yes (`version`) |
| orders   | `orders`    | `tickets` (replica)   | yes on both |
| payments | `payments`  | `orders` (replica)    | yes on the replica; payments are write-once |

## Mental model

> Schema lives in `db/types.ts` (typed) + `migrations/` (executed). All SQL lives
> in `repositories/`. `createDb(url)` makes the connection swappable. uuid PKs
> replace ObjectId; replicas keep the producer's id. OCC is an explicit
> `version`-guarded UPDATE. Tests run against real Postgres for fidelity.
