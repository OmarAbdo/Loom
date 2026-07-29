# =============================================================================
# auth service image (monorepo-aware) — see tickets/Dockerfile for full notes.
# =============================================================================
# BUILD CONTEXT = REPO ROOT (set in skaffold.yaml). auth depends on the shared
# `common/` package (but NOT `schemas/` — auth emits no events). common needs
# schemas to build, so we still build schemas first.
#
# node:20-slim (glibc) base: common pulls @confluentinc/kafka-javascript (native).
# =============================================================================
FROM node:20-slim

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

WORKDIR /app/auth
CMD ["npm", "start"]
