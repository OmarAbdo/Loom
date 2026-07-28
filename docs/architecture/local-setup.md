# Local Setup

How to stand the system up on a local **Docker Desktop Kubernetes** cluster.

> Migration status: as of Phase 3, the **infrastructure** (Kafka + Schema
> Registry) runs in-cluster. The application services are not yet rewired to it
> (Phases 4–5), so a full end-to-end run comes later. This doc grows as phases
> land.

## Prerequisites

- **Docker Desktop** with **Kubernetes enabled** (Settings → Kubernetes → Enable).
- `kubectl` and `skaffold` on PATH (Docker Desktop ships kubectl).
- Verify the cluster is reachable:
  ```bash
  kubectl cluster-info
  ```

## One-time cluster setup

### 1. Hosts file entry

The ingress serves the app at `ticketing.dev`. Map it to localhost:

```
# add to C:\Windows\System32\drivers\etc\hosts  (admin)
127.0.0.1  ticketing.dev
```

### 2. Ingress-nginx controller

The `ingress-srv.yaml` needs the ingress-nginx controller installed once:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

### 3. Secrets (never committed)

Create the secrets the deployments reference via `secretKeyRef`:

```bash
kubectl create secret generic jwt-secret --from-literal=JWT_KEY=<a-long-random-string>
kubectl create secret generic stripe-secret --from-literal=STRIPE_KEY=<your-stripe-test-key>
```

> These are created imperatively so no credential ever lands in a manifest or git.

## Bringing up the infrastructure (Phase 3)

Kafka and the Schema Registry can be applied directly:

```bash
kubectl apply -f infra/k8s/kafka-depl.yaml
kubectl apply -f infra/k8s/schema-registry-depl.yaml
```

Watch them come up:

```bash
kubectl get pods -w
# kafka-0 should reach Running; schema-registry-depl-* Running shortly after.
```

Kafka must be healthy before the Schema Registry (the registry stores schemas in
Kafka). If the registry crash-loops early, it is usually waiting for Kafka — give
`kafka-0` a moment to finish formatting storage and become ready.

### Registering the Avro schemas

With the registry reachable, register the event schemas
([schemas/](../../schemas/README.md)). Port-forward the registry and run the
register script:

```bash
kubectl port-forward svc/schema-registry-srv 8081:8081
# in another shell:
cd schemas
SCHEMA_REGISTRY_URL=http://localhost:8081 npm run register
```

Verify:

```bash
curl http://localhost:8081/subjects
# -> ["ticket:created-value","order:created-value", ...]
```

## Full dev loop (Phases 4–5 onward)

Once services are rewired, the whole system comes up with one command:

```bash
skaffold dev
```

Skaffold builds every image, applies `infra/k8s/*`, and streams logs with
hot-reload. See [`skaffold.yaml`](../../skaffold.yaml) for the build/sync wiring.

## Troubleshooting

- **Registry can't reach Kafka:** confirm `kafka-0.kafka-srv:9092` resolves — the
  advertised listener must match the headless Service DNS. `kubectl exec` into the
  registry pod and `nslookup kafka-0.kafka-srv`.
- **`kafka-0` CrashLoopBackOff on first boot:** check `kubectl logs kafka-0` — a
  changed `CLUSTER_ID` against an already-formatted PVC causes a mismatch; delete
  the PVC (`kubectl delete pvc kafka-data-kafka-0`) to reformat in dev.
- **Ingress 404:** ensure the ingress-nginx controller pod is Running and the
  hosts entry exists.

## Known dev simplifications

See [kubernetes-primitives.md](../concepts/kubernetes-primitives.md#known-dev-vs-prod-gaps-deliberate)
— no resource limits/probes, single replicas, PLAINTEXT Kafka (RF=1). Intentional
for local dev.
