# ADR-0004 — The shared `common` package is infra-only

**Status:** Accepted · **Date:** 2026-07-27

## Context

Grider ships a shared npm package, `@rallycoding/common`, imported by every
service. It contains a mix of things:

- **Infrastructure:** error classes, Express middleware (`current-user`,
  `require-auth`, `validate-request`, `error-handler`), and the base
  Publisher/Listener classes.
- **Domain:** the TypeScript interface for **every event** (`TicketCreatedEvent`,
  `OrderCreatedEvent`, …) and shared enums like `OrderStatus`.

Newman's strongest integration warning is against exactly this: a **shared library
that spans service boundaries and carries domain/contract types**. It reintroduces
the coupling microservices exist to remove — change an event shape and every
service must upgrade the library together. A shared *infrastructure* library is
tolerated; a shared *domain* library is a distributed-monolith smell.

## Decision

Keep a shared package, but make it **infra-only**, and publish it as
**`@omarabdo/ticketing-common`**.

**In the package:**
- Error classes (`BadRequestError`, `NotAuthorizedError`, `NotFoundError`, …).
- Express middleware (`currentUser`, `requireAuth`, `validateRequest`,
  `errorHandler`).
- The **Kafka base classes** (`Publisher`, `Consumer`) and the `kafka-wrapper`
  singleton — generic messaging *mechanics*, not any specific event.

**Out of the package (moved elsewhere):**
- **Event contracts** → Avro schemas in the Schema Registry
  ([ADR-0002](0002-avro-schema-registry.md)). Consumers generate types from schemas.
- Shared domain enums like `OrderStatus` → owned by the producing service and
  carried in the event schema, not imported cross-service as a TS type.

## Why still publish a package at all (vs. inlining, vs. a monorepo path)

- The base Publisher/Consumer and middleware are genuine, stable **infrastructure**
  shared verbatim by every service. Inlining them (copying into each service) would
  mean maintaining N copies of the Kafka mechanics during an active migration —
  painful and error-prone.
- Publishing to npm mirrors the real microservices pattern (a versioned internal
  library) and is what Omar chose. During development we use `npm link` to avoid a
  publish loop on every change; the real publish happens once the package
  stabilizes.
- npm package names cannot nest (`@scope/name` is the maximum; no `@a/b/c`), so the
  "ticketing/common" feel is expressed as scope=`omarabdo`, name=`ticketing-common`.

## Consequences

- **Positive:** the shared code that remains is domain-free infrastructure — the
  Newman-acceptable kind. Producer/consumer decoupling comes from the schema
  registry, not from a shared type.
- **Cost:** two mechanisms to keep contracts (registry) and infra (package) — but
  each now has a single, correct responsibility.
- **Discipline:** resist the temptation to "just put the event type in common." If
  a type is domain/contract, it belongs in a schema.
