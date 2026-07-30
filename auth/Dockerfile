# =============================================================================
# auth service image (monorepo-aware, MULTI-STAGE) — see tickets/Dockerfile for
# the full rationale. auth depends on common (not schemas directly), but common
# needs schemas to build, so schemas is still built in stage 1.
# Runtime carries only compiled output + pruned prod node_modules.
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

COPY auth/package*.json ./auth/
RUN cd auth && npm install
COPY auth/ ./auth/
RUN cd auth && npm run build

RUN cd schemas && npm prune --omit=dev \
 && cd ../common && npm prune --omit=dev \
 && cd ../auth && npm prune --omit=dev

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
COPY --from=build /app/auth/dist ./auth/dist
COPY --from=build /app/auth/package.json ./auth/package.json
COPY --from=build /app/auth/node_modules ./auth/node_modules

WORKDIR /app/auth
CMD ["npm", "run", "start:prod"]
