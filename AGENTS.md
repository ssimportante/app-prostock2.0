# ProStock POS & Inventory — Base44 dev notes

## What this is
A Next.js 15 (App Router, React 19) POS / inventory / kitchen-display app. Firebase
client SDK (Auth + Firestore) is configured against a real Firebase project
(`be-inventory-6vp69`) via the hardcoded `firebase-applet-config.json` — there is no
local Firebase emulator in the Base44 setup; the app talks to that hosted project
directly. Genkit (`@genkit-ai/google-genai`) powers two server-side AI flows.

## Running it (Base44)
`docker compose -f docker-compose.base44.yml up -d` — single `web` service on
`node:20`, repo bind-mounted at `/app`, deps installed at startup, `next dev` with
live reload on port 3000 (host `0.0.0.0`). No database service — data lives in
Firestore.

## Config quirks
- `next.config.ts` sets `allowedDevOrigins` from `BASE44_PUBLIC_HOST_SUFFIX` so the
  Base44 preview origin can load dev assets/HMR. Do not remove.
- `output: 'standalone'`, `typescript.ignoreBuildErrors` and
  `eslint.ignoreDuringBuilds` are all set in `next.config.ts`.
- File-watch polling (`CHOKIDAR_USEPOLLING`/`WATCHPACK_POLLING`) is enabled for the
  bind mount.

## Secrets
- `GOOGLE_GENAI_API_KEY` — Google AI API key for Genkit. NOT required to boot (the
  app and login page render without it); only the AI "suggest item details" flow
  needs it and will error on call until a real key is provided. Delivered via
  `/run/base44/app.env`.
- Firebase config is NOT a secret — it is committed in
  `firebase-applet-config.json` and is safe to ship in client code.

## Auth model
`AuthProvider` (`src/components/auth/AuthProvider.tsx`) gates all routes except
`/login`. Roles (admin / manager / stock-manager / user) are read from the Firestore
`users/{uid}` doc; `admin@beanespress.com` is auto-promoted to admin. Unauthenticated
users redirect to `/login`. Firestore security rules (`firestore.rules`) enforce the
same role model server-side.

## Verify it works
After `up -d`, `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` should
return 200 (the `/` route redirects to `/dashboard`, which redirects to `/login` for
anon users). The login page should render in the preview.
