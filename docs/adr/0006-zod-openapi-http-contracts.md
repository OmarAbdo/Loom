# ADR-0006 — HTTP contracts as Zod schemas, published as OpenAPI

**Status:** Accepted · **Date:** 2026-08-05

## Context

[ADR-0002](0002-avro-schema-registry.md) put every **event** contract into Avro
under a Schema Registry: a versioned, machine-readable, independently reviewable
artifact, with compatibility enforced at registration time.

The **HTTP** boundary had no equivalent. Request rules lived as
`express-validator` chains inline in each route file, and responses were
undeclared entirely — a handler returned whatever its repository happened to
select. Three concrete problems followed:

1. **No response contract.** `POST /api/users/signup` did `res.send(user)`. The
   public API shape was a side effect of a `.returning()` clause in
   `UserRepository`, so adding a column would silently widen the API. Nothing
   in code or tests would notice.
2. **No machine-readable description.** The React client had no artifact to
   generate types from, so client-side types were hand-maintained duplicates of
   server behaviour. The two could disagree and nothing would catch it.
3. **Contracts unreviewable in isolation.** Validation rules were interleaved
   with handler logic, so "what does this endpoint accept?" could only be
   answered by reading the implementation.

Newman's argument for explicit contracts is not specific to messaging: any
boundary crossed by an independently deployed consumer needs a schema that can
be versioned and reviewed on its own. The async boundary had one. The sync
boundary did not.

## Decision

**Define every HTTP request and response as a Zod schema, and generate an
OpenAPI 3.1 document per service from those same schemas.**

Each service gains:

- `src/schemas/index.ts` — Zod schemas for request bodies, path params, and
  response shapes, with `.openapi()` metadata (descriptions, examples).
- `src/openapi.ts` — registers each route against those schemas and builds the
  service's OpenAPI document.
- Swagger UI at `<prefix>/docs`, raw spec at `<prefix>/docs.json`.

`express-validator` is removed from all four services. `validateRequest` in
`common` becomes a schema-taking factory:

```ts
router.post('/api/tickets',
  requireAuth,
  validateRequest({ body: TicketBody }),
  handler);
```

### One schema, three uses

The reason for Zod specifically — over hand-written OpenAPI YAML, or over
keeping express-validator and adding a spec beside it — is that a single
declaration serves all three needs:

| Need | Mechanism |
| ---- | --------- |
| Runtime validation | `validateRequest({ body: Schema })` |
| Static TypeScript type | `z.infer<typeof Schema>` |
| Published documentation | `.openapi()` metadata → generated spec |

A hand-written spec is a **second source of truth** that drifts from the code
the moment someone edits a handler without editing the YAML. Generating from the
validator makes drift structurally impossible: the thing that rejects a bad
request is the thing that documents the endpoint.

### Symmetry with the event contracts

| | Events (async) | HTTP (sync) |
| --- | --- | --- |
| Artifact | `.avsc` in `schemas/avro` | Zod schema in `<svc>/src/schemas` |
| Published as | Registered subject | OpenAPI 3.1 at `/docs.json` |
| Consumers | Other services | Browser client, tooling |
| Compatibility enforced by | Schema Registry, on register | Code review + response tests |
| Owned by | The producing service | The serving service |

The asymmetry in the last two rows is deliberate and worth stating plainly: the
registry mechanically rejects a breaking Avro change, whereas nothing
mechanically rejects a breaking HTTP change. That is an accepted gap, not an
oversight — see *Consequences*.

## Why not the alternatives

**Keep express-validator, add OpenAPI separately.** Rejected: two definitions
per route, guaranteed to drift, and still no response contract.

**tRPC or a typed RPC layer.** Rejected: it assumes a TypeScript client and
couples client and server through a shared type import — the same cross-boundary
type coupling [ADR-0004](0004-infra-only-common.md) removed from events. OpenAPI
stays language-neutral and consumable by anything.

**A single aggregated spec for all services.** Rejected: it would require every
service to agree on one document at deploy time, reintroducing the lockstep
coupling that ADR-0004 exists to prevent. Each service owns and serves its own
spec; the aggregated page (below) is a **read-time** convenience that fetches
them independently, not a build-time artifact.

**Schemas in `common`.** Rejected for the same reason event types are not in
`common`: route contracts are domain, and `common` is infra-only. The
*mechanism* (`validateRequest`, the registry helpers, `serveDocs`) lives in
`common`; the *contracts* live in each service.

## Serving the docs

Two access paths, both browser-reachable through the ingress:

- **Per service** — `https://ticketing.dev/api/users/docs`, `/api/tickets/docs`,
  `/api/orders/docs`, `/api/payments/docs`.
- **Aggregated** — `https://ticketing.dev/docs`, one Swagger UI with a service
  dropdown.

Two routing constraints shaped this, both non-obvious:

1. **Docs live under the service's own API prefix.** The ingress routes by path
   prefix without rewriting, so a bare `/docs` on each service would collide on
   one ingress rule and resolve to the client app. `/api/users/docs` is the only
   form that reaches auth.
2. **The docs mount must precede the routers.** `/api/tickets/:id` matches
   `/api/tickets/docs` and would treat `"docs"` as a ticket id. Since the id
   params are now uuid-validated, that surfaces as a 400 rather than the Swagger
   page. Regression tests pin the ordering in tickets and orders.

The aggregated page is a static file in the **client** image
(`client/public/docs/index.html`), not a new service. The ingress already routes
`/` to `client-srv`, and Vite copies `public/` into `dist/` verbatim — so it
costs zero new Kubernetes objects. It fetches each `/docs.json` at runtime, so
it always reflects the running services rather than a bundled snapshot.

## Consequences

**Gained**

- Response shapes are now declared. `UserResponse` pins the user API to
  `{ id, email }`, and `PaymentResponse` pins payments to `{ id }` — so the
  `stripeId` charge handle cannot leak by an incautious `res.send(row)`. Both
  are covered by tests asserting the *documented* shape.
- Path params are validated. Previously a malformed `:id` reached Postgres as an
  invalid uuid literal and surfaced as a masked generic 400; it is now a clean
  field-level validation error.
- Bodies are stripped of unknown keys before reaching handlers (mass-assignment
  defence), and numeric strings are coerced once, at the boundary.
- A real bug was fixed in passing: express-validator's `.trim()` on the signin
  password meant a password with intentional leading or trailing whitespace
  could never be entered. Only the email is trimmed now.

**Costs and accepted gaps**

- **No mechanical compatibility gate.** Unlike the Schema Registry, nothing
  fails a build when an HTTP response shape changes incompatibly. The mitigation
  today is review plus per-service docs tests. A future step would be spec
  diffing in CI (e.g. `oasdiff`) to fail on breaking changes.
- **Adding a route means editing two files** — the route and `src/openapi.ts`.
  Accepted deliberately: it keeps the whole documented surface of a service
  legible in one place.
- **Swagger UI assets load from unpkg** on the aggregated page, so it needs
  internet access. Fine for a dev cluster; a production portal would vendor the
  assets into the image.
- **The client does not yet consume the spec.** Generating its API types from
  `/docs.json` is the natural follow-up and the main reason the raw spec is
  served at a stable URL.
