# =============================================================================
# orders service image (monorepo-aware) — see tickets/Dockerfile for full notes.
# BUILD CONTEXT = REPO ROOT (skaffold.yaml). Depends on shared schemas/ + common/.
# node:20-slim (glibc) base for native @confluentinc/kafka-javascript.
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

COPY orders/package*.json ./orders/
RUN cd orders && npm install
COPY orders/ ./orders/

WORKDIR /app/orders
CMD ["npm", "start"]
