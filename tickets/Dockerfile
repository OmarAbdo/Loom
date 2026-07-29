# =============================================================================
# tickets service image (monorepo-aware)
# =============================================================================
# BUILD CONTEXT = REPO ROOT (set in skaffold.yaml) so this Dockerfile can access
# the shared file: dependencies `common/` and `schemas/`, which live outside the
# service directory.
#
# BASE IMAGE: node:20-slim (Debian/glibc), NOT alpine. @confluentinc/kafka-
# javascript is a native librdkafka addon; alpine's musl libc can fail to load
# the prebuilt binary. Debian slim keeps glibc while staying reasonably small.
#
# BUILD ORDER: schemas -> common -> service. The service's `file:` deps point at
# the BUILT output of schemas (dist/) and common (build/), so both must be built
# before the service is installed.
# =============================================================================
FROM node:20-slim

WORKDIR /app

# --- build the shared schemas package ---
COPY schemas/package*.json ./schemas/
RUN cd schemas && npm install
COPY schemas/ ./schemas/
RUN cd schemas && npm run build

# --- build the shared common package (depends on built schemas) ---
COPY common/package*.json ./common/
RUN cd common && npm install
COPY common/ ./common/
RUN cd common && npm run build

# --- install + copy the tickets service ---
COPY tickets/package*.json ./tickets/
RUN cd tickets && npm install
COPY tickets/ ./tickets/

WORKDIR /app/tickets
CMD ["npm", "start"]
