# ADR-0005 — Keep the JWT-in-cookie auth (for now)

**Status:** Accepted · **Date:** 2026-07-27

## Context

Grider's auth works like this:

- `auth` service issues a **JWT** signed with a shared secret (`JWT_KEY`) on
  signin/signup and stores it in a **cookie-session** (unsigned cookie carrying the
  JWT).
- Every service independently verifies that JWT using the **same shared secret**,
  via the `current-user` middleware from the common package. There is no call back
  to `auth` to validate a token — verification is local and stateless.

This is simple and fully working. But note the coupling: **every service holds the
signing secret and knows how to verify tokens.** Newman would flag this — the
identity concern is smeared across all services, and rotating the secret or
changing the token scheme touches everything. The book-aligned evolution is to move
verification to an **edge gateway** or a dedicated **token service** / external IdP
(OIDC), so downstream services trust an already-verified identity.

## Decision

**Keep the existing JWT-in-cookie scheme** for this migration.

Rationale:

- Authentication is explicitly **not the learning focus** of this project — Kafka,
  Avro, and Postgres are. Auth is deliberately held constant so the migration stays
  focused.
- The current scheme is correct and self-contained; changing it would add a large,
  orthogonal moving part (a gateway or IdP) to an already-large refactor.
- `auth` is the one service Omar already modernized, so it's the stable anchor.

## Consequences

- **Positive:** smaller, focused migration; a known-good component stays fixed.
- **Carried compromise (flagged, not hidden):** the shared-secret-verified-
  everywhere coupling remains. It is a known Newman smell, documented here so it's a
  *decision*, not an oversight.
- **Deferred follow-up:** revisit auth as a separate effort — candidate directions
  are (a) verify only at the ingress/gateway and pass a trusted identity header
  downstream, or (b) adopt an external OIDC IdP (Keycloak self-hosted, or Auth0).
  Out of scope now.
