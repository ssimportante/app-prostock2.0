# ProStock POS & Inventory System

## Overview
Next.js 15 app (App Router) for cafe POS and inventory management. Originally Firebase-based; migrated to local PostgreSQL + Prisma with cookie-based session auth. Hardened for production with API auth, role-based authorization, CSRF protection, rate limiting, and production build support.

## Architecture
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Recharts, TanStack Table
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`)
- **Auth**: Cookie-based session auth (no Firebase). Session token signed with `SESSION_SECRET` env var (min 32 chars, enforced at boot). CSRF protection via double-submit cookie pattern.
- **Data layer**: SWR-based hooks (`useCollection`, `useDoc`) that call Next.js API routes (`/api/db/[collection]`, `/api/db/[collection]/[id]`)
- **File storage**: Local file serving via `/api/upload` and `/api/files/[...path]`

## Security
- **All API routes require authentication** — GET, POST, PUT, DELETE on `/api/db/*` and `/api/batch` check `getSessionUser()`.
- **Role-based authorization** — `src/lib/authz.ts` enforces: admin can do everything; stock-manager can write to items/categories/stations/taxes/staff/settings; all authenticated users can create sales/wasteEvents/stockReceipts; only admin can delete.
- **CSRF protection** — All mutation endpoints validate `X-CSRF-Token` header against the `prostock-csrf` cookie. Token is set on login. Client shims (`firestore-shim`, `auth-shim`, `storage-shim`) automatically include the header via `src/lib/csrf-client.ts`.
- **Login rate limiting** — 5 failed attempts per IP within 15 minutes triggers a 429 response.
- **Session secret enforcement** — `SESSION_SECRET` must be set and ≥32 chars or the app refuses to boot.
- **No login backdoor** — Default users are seeded via `prisma/seed.mjs`, not auto-created on login.

## Firebase Migration
Firebase modules are replaced via webpack aliases in `next.config.ts`:
- `firebase/firestore` → `src/lib/firestore-shim.ts`
- `firebase/auth` → `src/lib/auth-shim.ts`
- `firebase/storage` → `src/lib/storage-shim.ts`
- `firebase/app` → `src/lib/app-shim.ts`

The `firebase` and `firebase-admin` npm packages have been removed — all imports resolve to local shims via the webpack alias to `src/lib/firebase-compat`.

## Setup (Development)
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
This starts PostgreSQL and the Next.js dev server, runs Prisma migrations, and serves on port 3000. Seed data must be run manually:
```bash
docker compose -f docker-compose.base44.yml exec -T web npx node prisma/seed.mjs
```

## Setup (Production)
```bash
# 1. Copy the env template and fill in real values
cp .env.prod.example .env.prod
# Edit .env.prod — set DOMAIN, POSTGRES_PASSWORD, SESSION_SECRET, DATABASE_URL

# 2. Start the stack
docker compose -f docker-compose.prod.yml up -d --build
```
This starts:
- **Caddy** — reverse proxy with automatic TLS for the configured DOMAIN
- **PostgreSQL** — with credentials from .env.prod (no hardcoded passwords)
- **Web** — production Next.js build, runs Prisma `migrate deploy`, serves behind Caddy
- **Backup** — daily pg_dump with 7-day retention

All credentials are externalized via `.env.prod` (gitignored). See `.env.prod.example` for required variables.

## Default Users (seeded)
- `admin@beanespress.com` / `password` (admin role)
- `stockman@beanespress.com` / `password` (stock-manager role)
- `kitchen@beanespress.com` / `password` (kitchen-user role)
- `bar@beanespress.com` / `password` (bar-user role)

**For production**: Seeded users have `mustChangePassword: true` — they are forced to change their password on first login via `/change-password` and cannot navigate elsewhere until they do. Admin can reset other users' passwords via Settings → Users → key icon (which also sets `mustChangePassword: true`). New users created via admin also get `mustChangePassword: true`.

## Role-Based Access Control
- **admin**: Full access to all pages and API operations
- **stock-manager**: Stock Manager page + Settings (profile only); can write to items/categories/stations/taxes/staff/settings via API
- **kitchen-user**: Kitchen KDS page + Settings (profile only) only
- **bar-user**: Bar KDS page + Settings (profile only) only
- Legacy `manager` and `user` roles are removed from the UI but existing DB records are preserved; users with those roles are redirected to login.

## Admin User Management
- **Create User**: Settings → Users → "Create User" button (admin only)
- **Reset Password**: Settings → Users → key icon per user (admin only, except for admin@beanespress.com)
- **Change Own Password**: Settings → Profile → Change Password (all users)

## Production Hardening
- **Caddy reverse proxy** — `Caddyfile` configures automatic TLS for the domain set via `DOMAIN` env var. Caddy terminates HTTPS and proxies to the web service.
- **Externalized credentials** — All production secrets (DATABASE_URL, SESSION_SECRET, POSTGRES_PASSWORD, DOMAIN) are in `.env.prod` (gitignored). See `.env.prod.example` for the template.
- **Database backups** — A `backup` service in `docker-compose.prod.yml` runs daily `pg_dump` with 7-day retention to a Docker volume.
- **Forced password change** — Seeded users and admin-created users must change their password on first login. The `mustChangePassword` flag on the User model controls this. The `/change-password` page is rendered without the app layout and the AuthProvider blocks navigation to any other page until the password is changed.
- **Removed Firebase secret** — `FIREBASE_SERVICE_ACCOUNT_KEY` is no longer needed (Firebase fully removed) and marked as not required in `.base44/environment.json`.

## Key Files
- `prisma/schema.prisma` — database schema
- `prisma/migrations/` — Prisma migrations (use `migrate deploy` in production)
- `prisma/seed.mjs` — seed data (run manually, not on every restart)
- `src/lib/auth-server.ts` — session auth, CSRF token, password hashing
- `src/lib/authz.ts` — role-based authorization helper
- `src/lib/csrf-client.ts` — client-side CSRF token helper
- `src/lib/firestore-shim.ts` — Firestore API replacement
- `src/lib/auth-shim.ts` — Firebase Auth replacement
- `src/lib/storage-shim.ts` — Firebase Storage replacement
- `src/lib/fake-timestamp.ts` — Timestamp class mimicking Firestore Timestamp
- `src/app/api/` — all API routes
- `src/firebase/` — compatibility layer re-exporting shimmed functions
- `Dockerfile.prod` — production Dockerfile (multi-stage build)
- `docker-compose.prod.yml` — production compose config

## Verification
1. Login at `/login` with `admin@beanespress.com` / `password`
2. Dashboard should load with seeded items and categories
3. Navigate to POS (`/sales`), Items (`/items`), Stock (`/stock`), etc.
4. Settings → Users tab: Create User and Reset Password buttons should work (admin only)

## Tech Notes
- Dates are stored as PostgreSQL `DateTime` and serialized as `{ __timestamp, seconds, nanoseconds }` objects in API responses. The `FakeTimestamp` class (aliased as `Timestamp`) converts these back so existing `.toDate()` calls work.
- The `settings` collection stores data in a JSON `data` column; the API flattens it on read and wraps it on write for compatibility with existing component code.
- SWR provides real-time-like updates via revalidation-on-focus and short deduping intervals.
- `next.config.ts` has `ignoreBuildErrors: false` and `ignoreDuringBuilds: false` — all TypeScript and ESLint errors must be resolved for the build to pass.
