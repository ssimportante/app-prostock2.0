# AGENTS.md — ProStock (rebuilt)

## What this app is
A coffee-shop POS & inventory suite (Next.js 15 App Router + Tailwind + shadcn/ui), rebuilt
self-contained: no Firebase, no Genkit. Auth, data, and sessions are all in-app.

## Running it
```
docker compose -f docker-compose.base44.yml up -d
```
- `deps` service installs node_modules into a named volume (cached across restarts).
- `web` runs `next dev -p 3000 -H 0.0.0.0` with the repo bind-mounted; edits hot-reload.
- **npm must use `--legacy-peer-deps`** (React 19 vs older Radix peer ranges). The deps service does this.
- No secrets or external credentials are required to boot.
- `allowedDevOrigins` in next.config.ts is derived from `BASE44_PUBLIC_HOST_SUFFIX` (passed
  into the web container). Next dev auto-restarts when next.config.ts changes.

## Data layer (src/server)
- JSON file store at `.data/prostock.json` (gitignored), loaded once per Node process into a
  `globalThis` singleton (`src/server/db.ts`). Every API mutation calls `persist()`.
- First boot seeds rich demo data (users, categories, items incl. composites, 14 days of
  sales, waste, receipts) — `src/server/seed.ts`. Deterministic PRNG for stable seed.
- **Resetting demo data:** delete `.data/prostock.json` AND restart the web container
  (the in-memory singleton survives file deletion until the process restarts).
- Money is stored in integer cents everywhere; volume items (soldBy `volume`) carry a
  cents-per-unit rate that may be fractional (e.g. 0.85 ¢/ml milk). Totals round to cents.
- Sale totals math lives in `src/lib/checkout-math.ts` and is shared verbatim by the POS
  client preview and the server (`src/server/sales.ts`) so they can never disagree.
- Stock lives as batches on each item; consumption is FIFO by earliest expiry/roast/added
  date. Selling a composite deducts `component.quantity × qty ÷ yield` from components.

## Auth & roles
- Email/password login, scrypt hashes (`src/server/password.ts`), HMAC-random session
  tokens stored in the db, `ps_session` httpOnly cookie.
- 4 roles: admin, manager, stock-manager, user. Route map in `src/lib/rbac.ts`;
  server pages gate via `requirePageUser(roles)`, APIs via `apiGuard(roles)`.
- Demo accounts (password `password123`): admin@, manager@, stockman@, poc@ (stock-manager),
  cashier@beanespress.com — shown on the login screen.

## Verify the app works
```
curl -s -c /tmp/jar -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@beanespress.com","password":"password123"}'
curl -s -b /tmp/jar localhost:3000/api/reports/summary   # KPIs
curl -s -b /tmp/jar localhost:3000/api/items               # catalog
```
Then in the preview: log in → Dashboard KPIs/chart render → POS: tap tiles, Charge →
Kitchen Display shows the ticket and advances pending → preparing → completed.

## Gotchas
- Route handler params are Promises in Next 15 (`{ params }: { params: Promise<{id: string}> }`).
- Pages under `src/app/(app)/` share the authed shell layout; `/login` sits outside the group.
- KDS/bar boards poll `/api/sales` every 8s; status transitions are validated server-side
  (pending → preparing → completed; pending → cancelled only).
- Deleting an item referenced by a composite recipe is blocked (409) to avoid dangling refs.
