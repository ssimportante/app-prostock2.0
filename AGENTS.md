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
docker compose -f docker-compose.prod.yml up -d --build
```
This builds a production Docker image (multi-stage, standalone Next.js output), runs Prisma migrations via `migrate deploy`, and serves via `next start`. Requires `SESSION_SECRET` in the environment.

## Default Users (seeded)
- `admin@beanespress.com` / `password` (admin role)
- `stockman@beanespress.com` / `password` (stock-manager role)
- `kitchen@beanespress.com` / `password` (kitchen-user role)
- `bar@beanespress.com` / `password` (bar-user role)

**For production**: Change all passwords immediately after first login. Admin can reset other users' passwords via Settings → Users → key icon. The admin@beanespress.com password can only be changed via the Change Password flow.

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
