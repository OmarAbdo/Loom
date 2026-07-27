# `@omarabdo/ticketing-schemas` — event contracts

The **contract** layer of the ticketing system: the Avro schemas that define every
Kafka event's wire format, plus their hand-authored TypeScript mirrors.

Per [ADR-0002](../docs/adr/0002-avro-schema-registry.md), event contracts do **not**
live inside services or the shared `common` package — they are versioned here,
independently, and registered in the Confluent Schema Registry.

## Layout

```
schemas/
├── avro/                 # the runtime wire contract — one .avsc per event
│   ├── ticket-created.avsc
│   ├── ticket-updated.avsc
│   ├── order-created.avsc
│   ├── order-cancelled.avsc
│   ├── expiration-complete.avsc
│   └── payment-created.avsc
├── types/                # compile-time mirror — hand-authored TS interfaces
│   ├── subjects.ts       #   topic names (Subjects enum)
│   ├── order-status.ts   #   OrderStatus + Avro-symbol mapping
│   └── *-event.ts        #   one interface per event
└── src/
    ├── topic-schema-map.ts   # single source of truth: topic -> avsc -> subject
    ├── load-schema.ts        # shared .avsc loader
    ├── register.ts           # pushes schemas to the registry (npm run register)
    └── __test__/schema-parity.test.ts   # guard: .avsc <-> types stay in sync
```

## Two artifacts, kept honest

- **`avro/*.avsc`** is the source of truth for the *wire format*. It is what the
  serializer/deserializer use and what the registry stores and version-checks.
- **`types/*-event.ts`** is a hand-authored *compile-time* mirror so services get
  real TypeScript types for the payloads. We chose hand-authoring over codegen
  (ADR-0002) for clean, idiomatic types; the tradeoff is drift risk, neutralized
  by the parity guard test.

Run the guard: `npm test`. It fails if any schema's fields diverge from the typed
expectation table (which mirrors the interfaces).

## Subject naming

Confluent's default **TopicNameStrategy** derives the registry *subject* from the
Kafka *topic*: `subject = <topic>-value`. So topic `ticket:created` → subject
`ticket:created-value`. `topic-schema-map.ts` encodes this so the register script
and the runtime serdes agree.

## Compatibility

Target mode is **BACKWARD** (a new schema version can read data written by the
previous version → upgrade consumers before producers). Set globally on the
registry at deploy time (Phase 3) and, best-effort, per-subject by the register
script. See [`docs/concepts/avro-and-schema-registry.md`](../docs/concepts/avro-and-schema-registry.md).

## Registering

```bash
# with the registry reachable (port-forward in dev, or in-cluster):
SCHEMA_REGISTRY_URL=http://localhost:8081 npm run register
```

Registration is idempotent and enforces compatibility — an incompatible schema
change is rejected by the registry, which is the point.

## Notable modeling decisions

- **`price` is `double`** to mirror the pre-migration JS-number wire shape.
  Money-as-double is a known imprecision; switching to integer-cents or an Avro
  `decimal` logical type is deliberately deferred so the transport migration
  doesn't also change money math. (Flagged in each schema's `doc`.)
- **`OrderStatus.AwaitingPayment`** is `awaiting:payment` at the app level, but
  Avro enum symbols can't contain `:`, so the schema uses `awaiting_payment` and
  `order-status.ts` maps between them.
- **`expiresAt`** is a `string` (ISO-8601), mirroring the original wire shape
  rather than an Avro timestamp logical type.
