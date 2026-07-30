# =============================================================================
# client image — Vite/React SPA served as static files by nginx.
# =============================================================================
# Multi-stage: stage 1 builds the SPA with Node; stage 2 serves the built static
# assets with a tiny nginx image. The final image is ~50MB (nginx + static
# files) — contrast with the ~1.2GB backend images. This is the model the
# backend services could adopt later to shrink their footprint.
#
# BUILD-TIME ENV: the Stripe publishable key is baked in at build time via the
# VITE_STRIPE_PUBLISHABLE_KEY build arg (Vite inlines VITE_* at build). It is a
# public key, safe to ship. Override it per environment with --build-arg.
# =============================================================================

# ---- stage 1: build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# NOTE: Docker warns about ARG/ENV for "secrets" here, but a Stripe PUBLISHABLE
# key is public by design (it ships in the browser). The SECRET key is never in
# this image — it lives only in the payments service. The warning is a false
# positive for a publishable key.
ARG VITE_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
RUN npm run build

# ---- stage 2: serve ----
FROM nginx:1.27-alpine
# SPA routing: fall back to index.html so client-side routes (e.g. /orders/:id)
# resolve instead of 404ing at nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
