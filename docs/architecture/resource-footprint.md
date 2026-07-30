# Resource Footprint & Cost

Answers a practical question: *the cluster seemed to want ~15 GB of RAM on my
laptop — would that be expensive in the cloud?* Short answer: no. The 15 GB was
Docker Desktop's VM ceiling, not the app's real need. After this pass the whole
system reserves **~2 Gi** and is capped at **~3.8 Gi**.

## Where the memory actually goes

Three things inflated the observed number, none of them the app's steady-state:

1. **Docker Desktop's VM allocation.** `docker info` "Total Memory" is the VM's
   *limit* (what you granted Docker Desktop), and the VM caches/reserves much of
   it (page cache, the k8s control plane, containerd). It is a ceiling, not usage.
2. **Uncapped JVMs.** Kafka and the Schema Registry are Java; a JVM sizes its heap
   from host RAM by default and holds it. Kafka alone will sit at 1 GB+ unless
   told otherwise. This was the single biggest real consumer.
3. **`ts-node-dev` in every service.** The dev runtime compiles TypeScript
   in-memory and watches files — easily 150–300 MB per Node service vs. ~50–80 MB
   for compiled JS. Across 5 services, ~1 GB of pure dev overhead.

## What this pass changed

| Lever | Before | After |
| ----- | ------ | ----- |
| Kafka JVM heap | auto (host-sized, ~1 GB+) | `-Xmx512m`, limit 900 Mi |
| Schema Registry heap | auto | `-Xmx256m`, limit 512 Mi |
| Node services runtime | `ts-node-dev` (dev) | compiled `node dist/index.js` |
| Node service memory | uncapped | request 128 Mi / limit 256 Mi each |
| Postgres ×4 | uncapped | request 128 Mi / limit 256 Mi each |
| Backend image size | ~1.2 GB | ~780 MB (multi-stage, compiled runtime) |
| Client image | (Next.js) | 74 MB (nginx static) |
| **Cluster memory (requests)** | uncapped | **~2.0 Gi reserved** |
| **Cluster memory (limits)** | → 15 GB VM ceiling | **~3.8 Gi ceiling** |

The cluster now fits comfortably in a **4 GB** Docker Desktop allocation. Lower
Docker's memory setting to 4 GB and it still runs — proof the 15 GB was headroom,
not need.

## Multi-stage images

Each backend Dockerfile is two stages:

- **build** — install + compile `schemas` → `common` → service to plain JS, then
  `npm prune --omit=dev` to drop the toolchain (ts-node-dev, jest, typescript,
  Testcontainers, …).
- **runtime** — a slim image carrying only the compiled `dist/` + pruned
  production `node_modules`, run with `node dist/index.js`.

Result: ~780 MB instead of ~1.2 GB, and — more importantly for RAM — a runtime
process with **no TypeScript compiler / file-watcher** loaded (plain `node` on
compiled JS). The image is still sizeable because `@confluentinc/kafka-javascript`
ships prebuilt librdkafka binaries and each of schemas/common/service keeps its
own pruned `node_modules`; a workspace with hoisted, deduped deps (or bundling
with esbuild) would cut it much further. `node:20-slim` (glibc) is the base
because the Kafka client is a native addon. **The size is a disk concern; the RAM
win comes from the heap caps + limits + compiled runtime above, not image size.**

> A monorepo wrinkle this surfaced: `express`/`express-validator` were *peer*
> dependencies of `common`, so `npm prune` removed them from the runtime image
> and `common`'s middleware couldn't resolve them. Fixed by making them regular
> `dependencies` of `common` (they install into `common/node_modules` and always
> resolve). A pnpm/npm workspace with hoisting would be the more elegant long-term
> answer.

## How you'd actually deploy this (cloud cost)

You would **not** rent a 15 GB always-on VM:

- **Stateless Node services** run in ~128–256 MB each with hard limits — trivial
  to pack many onto a small node, or run serverless-style.
- **Kafka** → a managed offering (Confluent Cloud, MSK, Redpanda Cloud), billed by
  **throughput/retention**, not by RAM you reserve 24/7. Not your VM at all.
- **Postgres** → managed (RDS, Neon, Supabase), sized per service, often on a
  shared/burstable tier.
- **Schema Registry** → part of the managed Kafka offering, or one small shared
  instance.

So the recurring cost is dominated by *managed data services billed on usage*,
not by a big block of reserved RAM. The self-hosted-everything-on-one-VM shape is
a **local dev convenience**, not the deployment model.

## Still deferred (would tighten further)

- **Liveness/readiness probes** — would let k8s gate traffic until a service is
  actually ready (today services fail-fast and restart until deps are up).
- **HPA / autoscaling** — the resource *requests* set here are the prerequisite;
  autoscaling policies are a next step.
- **Distroless / smaller base** — `node:20-slim` could become distroline/alpine
  with more native-build care, shaving the image further.
