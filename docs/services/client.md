# Service: client (Vite + React SPA)

The browser UI. Rebuilt from Grider's minimal Next.js client into a
**client-rendered SPA** (Vite + React + TypeScript) that drives the full
purchase flow: browse tickets → sell a ticket → order → pay (Stripe) → watch the
order complete.

## Why an SPA (not Next.js SSR)

Grider's client used Next.js with `getInitialProps` to fetch `currentUser`
server-side. We dropped SSR for a plain SPA:

- Simpler mental model — no server-render step, no Next.js data-fetching lifecycle.
- The app is static files served by nginx; it just calls the same-origin `/api/*`.
- Tradeoff: `currentUser` is fetched **in the browser on load** (a brief loading
  state on first paint) instead of being known at server-render time. See
  `src/context/AuthContext.tsx`.

## Structure

```
client/
├── index.html
├── vite.config.ts        # dev proxy: /api -> ingress (Host: ticketing.dev)
├── nginx.conf            # SPA fallback to index.html for client-side routes
├── Dockerfile            # multi-stage: node build -> nginx serve (~74MB)
└── src/
    ├── main.tsx          # Router + AuthProvider bootstrap
    ├── App.tsx           # routes
    ├── api/              # axios instance (withCredentials) + response types
    ├── context/          # AuthContext (currentUser on load)
    ├── components/       # Header, Errors, StatusBadge, PaymentForm
    ├── stripe.ts         # Stripe.js loader (publishable key via VITE_ env)
    └── pages/            # Landing, Signup, Signin, NewTicket, Orders, OrderShow
```

## Routes / features

| Route | Page | What it does |
| ----- | ---- | ------------ |
| `/`              | Landing   | Lists all tickets; signed-in users can Purchase (creates an order). |
| `/auth/signup`   | Signup    | Create an account; sets the session cookie. |
| `/auth/signin`   | Signin    | Sign in. |
| `/tickets/new`   | NewTicket | Sell a ticket (title + price). |
| `/orders`        | Orders    | The current user's orders with status badges. |
| `/orders/:id`    | OrderShow | Order detail + live expiry countdown + Stripe payment; polls until complete/cancelled. |

## Auth & cookies

`api` (axios) is created with `withCredentials: true`. Because the SPA is served
from the **same origin** as the APIs (behind the `ticketing.dev` ingress in the
cluster; via the Vite dev proxy locally), requests are same-origin and the auth
cookie flows with no CORS setup. The cookie is `secure`, so it only works over
HTTPS (the ingress terminates TLS).

## Payment (Stripe.js, test mode)

`PaymentForm` uses `@stripe/react-stripe-js`:

1. The card is entered into a Stripe **Elements** `CardElement` (the card data
   never touches our code).
2. `stripe.createToken(card)` tokenizes it in the browser.
3. We POST `{ orderId, token }` to `/api/payments`; the payments service performs
   the charge server-side with the **secret** key and publishes `payment.created`.
4. `OrderShow` polls the order; once the saga marks it `complete`, the UI updates.

Keys:
- **Publishable key** (`pk_test_…`) is a **build-time** env var
  (`VITE_STRIPE_PUBLISHABLE_KEY`), baked into the bundle. It is public by design.
  A placeholder ships by default; set the real test key via the Docker
  `--build-arg` (or `.env` for `vite dev`).
- **Secret key** (`sk_test_…`) lives ONLY in the payments service (the
  `stripe-secret` k8s Secret). It is never in the client image.

## Running

**Against the cluster (dev, hot-reload):**

```bash
# port-forward the ingress so /api is reachable:
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8443:443
# then, in client/:
VITE_API_TARGET=https://localhost:8443 npm run dev
# open the Vite URL; /api/* is proxied to the cluster with the ticketing.dev Host.
```

**In the cluster:** `skaffold dev`/`run` builds the image and the ingress serves
the SPA at `https://ticketing.dev/` (everything not under `/api/...`).

## Build

```bash
npm run build   # tsc typecheck + vite build -> dist/ (static assets)
```

The Docker image is multi-stage (node build → nginx serve), ~74MB — a fraction
of the backend images, and a template for slimming those later.
