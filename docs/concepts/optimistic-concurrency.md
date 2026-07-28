# Concept: Optimistic Concurrency Control (OCC) and the `version` field

This is one of the most important — and most easily misunderstood — mechanisms in
the system. It solves two distinct problems with one field, which is elegant but
worth pulling apart.

## The two problems

### Problem 1 — concurrent writes to the same record

Two requests update the same ticket at nearly the same time. Without protection,
the second write can silently clobber the first (lost update). **Optimistic**
concurrency assumes conflicts are rare and doesn't lock; instead it *detects* a
conflict at write time and rejects the loser.

Mechanism: every record carries an integer `version`. An update is conditional:

```sql
UPDATE tickets
   SET title = $1, price = $2, version = version + 1
 WHERE id = $3
   AND version = $4;      -- $4 = the version the caller read
```

If another writer already bumped the version, the `WHERE` matches **0 rows**. The
application treats "0 rows updated" as a **concurrency conflict** and retries or
errors. Whoever commits first wins; the loser is told to re-read and try again.

> In Grider's Mongo version this is the `mongoose-update-if-current` plugin, which
> does the same `version`-guarded update under the hood. In our Postgres version we
> write the guard explicitly — which is why the pattern is *clearer* in SQL.

### Problem 2 — out-of-order event processing across services

`orders` keeps a **local replica** of tickets, updated by consuming `ticket:created`
and `ticket:updated` events. Kafka gives per-partition ordering, but a naive
consumer that processed events as they arrived could still apply a stale update if
events were ever reordered or reprocessed (at-least-once means events can repeat).

Mechanism: the **same `version`** rides along in the event payload. The consumer
applies an update **only if it is the immediate successor** of what it already has:

```sql
-- find the record we can legally advance:
SELECT * FROM tickets WHERE id = $1 AND version = $2 - 1;
```

- If found → this event is exactly the next version; apply it, storing the new
  version.
- If not found → either we already processed it (duplicate) or a predecessor hasn't
  arrived yet. The consumer does **not** ack/commit, so Kafka will redeliver, and
  the event is applied once its predecessor lands. This makes the replica
  **eventually consistent and idempotent** without any coordination.

This is the `findByEvent({ id, version })` logic in the models.

## Why one field does both jobs — and the seam it hides

The `version` incremented by the DB write (Problem 1) is the *same* number embedded
in the outgoing event and checked by consumers (Problem 2). That's why it works so
seamlessly: the producer's write-versioning *is* the consumer's ordering signal.

**But** this conflates two concerns:

- a **persistence** concern (optimistic lock on a single DB), and
- a **messaging** concern (event ordering across services).

They happen to align today because each state change produces exactly one event.
If that invariant ever broke (e.g. a write that emits two events, or an event not
tied to a version bump), the coupling would surface as a bug. We **keep** the
conflation (it's correct and unwinding it is a large change) but flag it as a
**known seam** — see the migration plan's "known compromises."

## Where to see it in the code

- Producer side: the `version` column + guarded `UPDATE` in each service's repo —
  e.g. `tickets/src/repositories/ticket-repository.ts` `update()` (throws
  `ConcurrencyError` on a 0-row result) and `orders`/`payments` order repos.
- Event side: `version` field in every event's Avro schema (`schemas/avro/`).
- Consumer side: `findByEvent`-style "predecessor" lookup in replica-holding
  services — `orders/src/repositories/ticket-repository.ts` and
  `payments/src/repositories/order-repository.ts` (`findByEvent` = `WHERE version = $ - 1`).
- Verified: `tickets` repo tests include a "two concurrent writers, exactly one
  wins" case against real Postgres — see [postgres-and-kysely.md](postgres-and-kysely.md).

## Mental model

> Optimistic concurrency = "assume no conflict, verify at commit, reject the loser."
> The `version` field is simultaneously the commit-time guard **and** the sequence
> number that lets downstream replicas apply events exactly once, in order.
