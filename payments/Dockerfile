# =============================================================================
# payments service image (monorepo-aware, MULTI-STAGE) — see tickets/Dockerfile
# for the full rationale. Build stage compiles schemas -> common -> service to
# JS; runtime stage carries only compiled output + pruned prod node_modules,
# run with `node dist/index.js`. Base node:20-slim (glibc) for native Kafka.
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

COPY payments/package*.json ./payments/
RUN cd payments && npm install
COPY payments/ ./payments/
RUN cd payments && npm run build

RUN cd schemas && npm prune --omit=dev  && cd ../common && npm prune --omit=dev  && cd ../payments && npm prune --omit=dev

# ---- stage 2: runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/schemas/dist ./schemas/dist
COPY --from=build /app/schemas/package.json ./schemas/package.json
COPY --from=build /app/schemas/node_modules ./schemas/node_modules
COPY --from=build /app/schemas/avro ./schemas/avro
COPY --from=build /app/common/build ./common/build
COPY --from=build /app/common/package.json ./common/package.json
COPY --from=build /app/common/node_modules ./common/node_modules
COPY --from=build /app/payments/dist ./payments/dist
COPY --from=build /app/payments/package.json ./payments/package.json
COPY --from=build /app/payments/node_modules ./payments/node_modules

WORKDIR /app/payments
CMD ["npm", "run", "start:prod"]
