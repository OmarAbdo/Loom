# Architecture Decision Records (ADRs)

An ADR captures a single significant architectural decision: the context that
forced a choice, the options considered, the decision made, and its consequences.
The value is future-you (or a reviewer) understanding *why*, not just *what*.

Format used here is a lightweight variant of Michael Nygard's template.

| ADR | Decision | Status |
| --- | -------- | ------ |
| [0001](0001-kafka-over-nats.md) | Replace NATS Streaming with Apache Kafka (KRaft) | Accepted |
| [0002](0002-avro-schema-registry.md) | Event contracts as Avro in a Schema Registry | Accepted |
| [0003](0003-postgres-per-service.md) | Postgres-per-service via Kysely, replacing MongoDB | Accepted |
| [0004](0004-infra-only-common.md) | The shared `common` package is infra-only | Accepted |
| [0005](0005-keep-jwt-auth.md) | Keep the JWT-in-cookie auth (for now) | Accepted |
| [0006](0006-zod-openapi-http-contracts.md) | HTTP contracts as Zod schemas, published as OpenAPI | Accepted |
