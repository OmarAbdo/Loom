# =============================================================================
# tickets service image (monorepo-aware, MULTI-STAGE)
# =============================================================================
# BUILD CONTEXT = REPO ROOT (skaffold.yaml) so we can access the shared file:
# deps common/ and schemas/.
#
# STAGE 1 (build): install + compile schemas -> common -> service to plain JS.
# STAGE 2 (runtime): a slim image that carries ONLY the compiled output and the
# production node_modules, run with `node dist/index.js` (no ts-node-dev, no
# TypeScript, no build toolchain). This is dramatically smaller and lighter at
# runtime than shipping the whole dev tree — the fix for the RAM/cost concern.
#
# Base: node:20-slim (glibc) both stages — @confluentinc/kafka-javascript is a
# native librdkafka addon that needs glibc.
# =============================================================================

# ---- stage 1: build ----
FROM node:20-slim AS build
WORKDIR /app

COPY schemas/package*.json ./schemas/
RUN cd schemas && npm install
COPY schemas/ ./schemas/
RUN cd schemas && npm run build

COPY common/package*.json ./common/
RUN cd common && npm install
COPY common/ ./common/
RUN cd common && npm run build

COPY tickets/package*.json ./tickets/
RUN cd tickets && npm install
COPY tickets/ ./tickets/
RUN cd tickets && npm run build

# Prune each package to production deps only (drops ts-node-dev, jest, typescript,
# testcontainers, etc.) so the runtime image carries the minimum.
RUN cd schemas && npm prune --omit=dev \
 && cd ../common && npm prune --omit=dev \
 && cd ../tickets && npm prune --omit=dev

# ---- stage 2: runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Shared packages: their built output + pruned node_modules (the service's
# file: deps resolve to these via the copied symlinks/dirs).
COPY --from=build /app/schemas/dist ./schemas/dist
COPY --from=build /app/schemas/package.json ./schemas/package.json
COPY --from=build /app/schemas/node_modules ./schemas/node_modules
COPY --from=build /app/schemas/avro ./schemas/avro
COPY --from=build /app/common/build ./common/build
COPY --from=build /app/common/package.json ./common/package.json
COPY --from=build /app/common/node_modules ./common/node_modules

# The service: compiled dist + pruned node_modules + package.json.
COPY --from=build /app/tickets/dist ./tickets/dist
COPY --from=build /app/tickets/package.json ./tickets/package.json
COPY --from=build /app/tickets/node_modules ./tickets/node_modules

WORKDIR /app/tickets
CMD ["npm", "run", "start:prod"]
