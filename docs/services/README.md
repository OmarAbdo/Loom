# Services

One page per service, documenting its REST API, the events it produces/consumes,
its data model, and its tests. Written/updated as each service is migrated (Phase 5)
so the page matches the real, migrated code rather than the Grider baseline.

| Service | Page | Status |
| ------- | ---- | ------ |
| auth       | `auth.md`       | ☐ per-service page pending (wired in Phase 5) |
| tickets    | `tickets.md`    | ☐ per-service page pending (wired in Phase 5) |
| orders     | `orders.md`     | ☐ per-service page pending (wired in Phase 5) |
| expiration | `expiration.md` | ☐ per-service page pending (wired in Phase 5) |
| payments   | `payments.md`   | ☐ per-service page pending (wired in Phase 5) |
| [client](client.md) | `client.md` | ✅ Phase 8 |

Note: the backend services are fully wired and documented across the ADRs,
concept docs, and the saga doc; dedicated per-service API pages are a nice-to-have
still pending. The client has its own page since it was a ground-up rebuild.
