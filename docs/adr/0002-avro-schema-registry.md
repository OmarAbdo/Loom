# ADR-0002 — Event contracts as Avro in a Schema Registry

**Status:** Accepted · **Date:** 2026-07-27

## Context

In Grider's design, an event's contract is a **TypeScript interface** exported from
the shared `@rallycoding/common` package (e.g. `TicketCreatedEvent`), and the wire
format is `JSON.stringify` of the `data` field. Both producer and consumer import
the *same* interface.

This has two problems Newman (*Building Microservices*, ch. on integration &
contracts) calls out directly:

1. **Compile-time coupling between producer and consumer.** They share a concrete
   type. A change to the producer's event shape forces every consumer to upgrade
   the shared package in lockstep — the hallmark of a *distributed monolith*.
2. **No enforced compatibility.** Nothing stops a producer from shipping a breaking
   change. "The contract" is a convention, checked only by whoever remembers to.

Newman's prescriptions: make schemas **explicit**, keep the contract owned by the
producer but expressed as a **schema** (not a shared code type), and lean on
**tolerant readers** and **schema compatibility rules** so services evolve
independently.

## Decision

Adopt **Apache Avro** as the event serialization format, with schemas managed by a
**Confluent Schema Registry** running in the cluster.

- Each event has an `.avsc` schema, versioned in the registry independently of any
  service's source tree.
- Producers serialize with Avro; the registry assigns/validates a schema ID that
  travels with each message (Confluent wire format: magic byte + schema id + Avro
  body).
- Consumers deserialize using the **writer's** schema (fetched by id) reconciled
  against their own **reader's** schema — Avro performs this resolution. This *is*
  the tolerant-reader pattern, implemented by the framework rather than by hand.
- The registry enforces a **compatibility mode** (we use `BACKWARD`: new schema can
  read data written by the previous schema) at publish time, so a breaking change
  is rejected before it ships.
- Consumers **generate their TS types from the schema**, so they depend on the
  schema artifact, not on the producer's source.

### Why Avro over Protobuf

Both are compact binary formats with schema evolution and registry support. For
*this* system Avro is the better fit:

- **Native to Kafka + Confluent Schema Registry.** Avro is the first-class,
  best-documented path; the registry's defaults and tooling are Avro-first.
- **Writer/reader schema resolution is built in** — the schema travels (by id) with
  the data and Avro reconciles versions automatically. This is the purest
  expression of the tolerant-reader lesson, which is the pedagogical point.
- Protobuf's advantage is a single IDL shared across **gRPC** and polyglot
  services. This system has neither: synchronous calls are REST, and it's all
  TypeScript. Protobuf's evolution is also manual field-tag discipline rather than
  framework-resolved.

See `docs/concepts/avro-and-schema-registry.md` for the mechanics.

## Consequences

- **Positive:** producer↔consumer decoupling; enforced, automated compatibility;
  compact binary wire format; the schema evolution lesson made concrete.
- **Positive for `common`:** event *types* leave the shared package entirely,
  enabling the infra-only common of [ADR-0004](0004-infra-only-common.md).
- **Cost / new moving parts:** a Schema Registry service to run (Phase 1), an Avro
  serdes layer in the base Publisher/Consumer (Phase 2), and a codegen step per
  service. More upfront complexity than `JSON.stringify` — deliberately accepted as
  the core "make it Newman-grade" upgrade.
- **Discipline:** schema changes must respect the compatibility mode; the registry
  enforces it, which is the point.
