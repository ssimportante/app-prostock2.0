# ProStock — Base44 Dev Environment

## Overview
Next.js 15 app (App Router) for POS inventory management. Uses Firebase (Auth + Firestore) client-side; config is in `firebase-applet-config.json` (public, no env secrets needed).

## Running the app
```bash
docker compose -f docker-compose.base44.yml up -d
```
- Web entry point: `http://localhost:3000` (maps to container port 3000)
- Dev server: `next dev --hostname 0.0.0.0` with live reload (polling enabled via `WATCHPACK_POLLING=true`)
- Dependencies install on container startup via `npm install`
- Healthcheck: node-based HTTP check on port 3000

## Key architecture notes
- Firebase config is hardcoded in `firebase-applet-config.json` — no secrets/env vars required to boot.
- Auth roles: `admin`, `manager`, `stock-manager`, `user` — route access controlled in `AuthProvider.tsx`.
- `next.config.ts` has `allowedDevOrigins` set from `BASE44_PUBLIC_HOST_SUFFIX` for preview HMR.
- `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` are both `true` in next.config.

## Firestore collections
- `items`, `categories`, `subcategories`, `stations`, `taxes`, `users`, `tags` (via items), `wasteEvents`, `stockReceipts`, `staff` (new)
