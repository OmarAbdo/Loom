# Concept: Testing strategy (the pyramid)

How this system is tested, why at each level, and where Newman's testing chapter
points next. The guiding idea is the **test pyramid**: many fast, isolated tests
at the bottom; fewer, slower, broader tests toward the top.

## The levels, as built here

```
        ╱╲        (few)  end-to-end: real cluster smoke — the full saga over Kafka
       ╱  ╲
      ╱----╲      integration: HTTP routes against a REAL Postgres (Testcontainers)
     ╱      ╲                   + listeners driving repos, with Kafka publish mocked
    ╱--------╲    (many) unit: repositories (OCC), base Publisher/Consumer, pure logic
```

### Unit — fast, isolated

- **Repositories** (`*/src/repositories/__test__`): the data-access logic,
  crucially the **optimistic-concurrency** behavior — including a
  "two concurrent writers, exactly one wins" test that only means something
  against a real engine.
- **Base Publisher / Consumer** (`common`): serialize + key + `send`; the
  manual-commit / ack-gating semantics (commit `offset+1` only after `ack()`).
- **Listeners** (`*/src/events/listeners/__test__`): each consumer's `onMessage`
  invoked directly with a fake `Message`, asserting the DB effect + that it
  published + that it acked (or threw and did NOT ack). This is where the saga's
  **"don't cancel a paid order"** rule is pinned.
- **Pure logic**: e.g. expiration's delay calculation.

> These use a real Postgres via **Testcontainers**, not an in-memory fake — the
> OCC and constraint behavior we test depends on real SQL semantics
> ([postgres-and-kysely.md](postgres-and-kysely.md)). Kafka is mocked here (the
> base Publisher is stubbed to a `global.kafkaSend` spy) so no broker is needed.

### Integration — routes + real DB

- **HTTP route tests** (`*/src/routes/__test__`) drive the Express app with
  `supertest` against a real Testcontainers Postgres, asserting status codes,
  DB writes, auth, and that the right event was published. This catches wiring
  the unit tests can't (middleware order, validation, cookie/JWT flow).

### End-to-end — the real cluster

- The **live smoke** (Phase 5h/6): deploy everything with `skaffold`, then drive
  real HTTP through the ingress and watch the choreographed saga propagate over
  Kafka across services (order → ticket reserved → replicas updated → expiration
  scheduled). This is the only level that exercises Kafka, Avro/registry, the
  network, and startup ordering together. It is deliberately **few** — expensive
  and slow, run to validate the whole, not every branch.

## Why this split (and why Testcontainers over mocks)

- Mocking the DB would make unit tests fast but let real SQL bugs through — and
  this is a DB-focused learning project. Real Postgres already caught a
  uuid-vs-placeholder bug a fake would have swallowed. So the "unit" layer here
  is a bit heavier than a purist pyramid, by choice.
- Mocking **Kafka** at the unit/integration level is the right call: the base
  Publisher/Consumer are tested once (in `common`), so each service can stub them
  and assert intent (`kafkaSend` called) without a broker. The real broker is
  covered by the e2e smoke.

## What's here vs. deferred (Newman's testing chapter)

**Here:** unit + integration + a live e2e smoke — a working pyramid.

**Deferred, and why they'd be the next investment:**

- **Consumer-driven contract tests (Pact-style).** Newman argues these are what
  truly let services deploy **independently**: the consumer declares the shape it
  needs from a producer's event, and the producer's build verifies it still
  satisfies that contract — without spinning up both services together. We get
  *part* of this benefit already from the **Avro Schema Registry** with `BACKWARD`
  compatibility (a producer can't ship a schema that breaks existing readers —
  see [avro-and-schema-registry.md](avro-and-schema-registry.md)). Contract tests
  would add the *consumer-expectation* half (the registry enforces structural
  compatibility; contract tests enforce that a consumer's actual needs are met).
- **Automated e2e in CI.** The smoke is currently manual. Wrapping it in a
  scripted acceptance suite (spin cluster → run flow → assert) would make it
  repeatable.

## Running the tests

```bash
# per service (real Postgres via Testcontainers → run in-band, Docker required):
cd <service> && npx jest --watchAll=false --runInBand

# data-layer only (repositories), where a service has a split config:
cd <service> && npm run test:db
```

Suite sizes: tickets 26, auth 14, orders 23, payments 13, expiration 2, common 7,
schemas 13 — plus the client's typecheck+build.

## Mental model

> Push logic down to fast unit tests against real Postgres; test wiring at the
> route level; prove the *whole* only at the e2e smoke. Kafka is stubbed below
> e2e (tested once in common) and real at e2e. The Schema Registry already gives
> half of contract testing; Pact-style consumer contracts are the documented next
> step.
