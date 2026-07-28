# Concept: Kubernetes primitives used here

A focused tour of only the Kubernetes objects this project uses, and *why each
kind* was chosen. Not a general k8s tutorial — just enough to read our
`infra/k8s/` manifests with understanding.

## Deployment vs StatefulSet — the key distinction

Both manage a set of identical pods. The difference is **identity and storage**:

| | Deployment | StatefulSet |
| --- | --- | --- |
| Pod names | random (`auth-depl-7d9f-x2k`) | stable, ordinal (`kafka-0`, `kafka-1`) |
| Pod DNS | none per-pod | stable per-pod via a headless Service |
| Storage | ephemeral / shared | stable per-pod PVC that survives restarts |
| Use when | pods are interchangeable & stateless | pods have identity or own disk |

In this project:

- **Stateless services** (`auth`, `tickets`, `orders`, `payments`, `expiration`,
  `client`, `schema-registry`) are **Deployments** — any replica is as good as any
  other; nothing is lost if a pod is rescheduled.
- **Kafka** is a **StatefulSet** — it owns the event log + KRaft metadata on disk
  and must advertise a *stable* hostname (`kafka-0.kafka-srv`) that survives
  restarts. (Phase 4 adds one **Postgres StatefulSet per service** for the same
  reason: each owns its data on disk.)

> Note the Schema Registry is a *Deployment* even though it's "about" schemas —
> because it stores its data **in Kafka** (`_schemas` topic), not on its own disk.
> Statefulness is about who owns disk/identity, not about whether the data matters.

## Service — stable virtual address

A **Service** gives a stable name + virtual IP in front of a set of pods
(selected by label), load-balancing across them. Services talk to each other by
Service name via cluster DNS (`auth-srv`, `tickets-srv`, …).

- A normal Service (`auth-srv`) load-balances to any matching pod.
- A **headless Service** (`clusterIP: None`, our `kafka-srv`) does *not*
  load-balance; instead DNS resolves to the individual pods
  (`kafka-0.kafka-srv`). This is what gives a StatefulSet its stable per-pod DNS.

## Ingress — the single front door

An **Ingress** (`ingress-srv.yaml`) routes external HTTP into the cluster by path.
Ours sends `/api/users` → `auth-srv`, `/api/tickets` → `tickets-srv`, etc., and
everything else → `client-srv`. It is backed by the **ingress-nginx** controller
(installed once per cluster — see [local-setup](../architecture/local-setup.md)).
This is the only synchronous entry point; services never call each other over
HTTP.

## Secret — credentials out of manifests

A **Secret** holds sensitive values injected as env vars via `secretKeyRef`. We
use `jwt-secret` (the shared `JWT_KEY`) and `stripe-secret`. Secrets are created
imperatively (not committed) — see local-setup. Never put these in a manifest or
in git.

## PersistentVolumeClaim (PVC) — durable disk

A **PVC** requests durable storage that outlives a pod. StatefulSets declare a
`volumeClaimTemplates` so each pod gets its own PVC (our Kafka `kafka-data`). On
Docker Desktop the default StorageClass provisions these automatically.

## fieldRef & downward API

The service deployments set `KAFKA_CLIENT_ID` from `metadata.name` via a
`fieldRef`. This "downward API" injects pod metadata as an env var, giving each
replica a distinct, stable client id — the same trick Grider used for
`NATS_CLIENT_ID`.

## Known dev-vs-prod gaps (deliberate)

- **No resource requests/limits** on containers (a linter will warn). Fine for a
  local single-tenant cluster; production must set these to avoid noisy-neighbor
  and enable scheduling/autoscaling.
- **Single replica** everywhere, **PLAINTEXT** Kafka, RF=1. Dev simplifications;
  production needs HA (RF>=3, multiple brokers), TLS/SASL, and probes.
- **No liveness/readiness probes** yet. Adding them (esp. for Kafka + registry
  ordering) is a reasonable hardening follow-up.
