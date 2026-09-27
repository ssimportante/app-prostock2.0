# ProStock POS & Inventory System

## Overview
Next.js 15 app (App Router) for cafe POS and inventory management. Originally Firebase-based; migrated to local PostgreSQL + Prisma with cookie-based session auth.

## Architecture
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Recharts, TanStack Table
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`)
- **Auth**: Cookie-based session auth (no Firebase). Session token signed with `SESSION_SECRET` env var.
- **Data layer**: SWR-based hooks (`useCollection`, `useDoc`) that call Next.js API routes (`/api/db/[collection]`, `/api/db/[collection]/[id]`)
- **File storage**: Local file serving via `/api/upload` and `/api/files/[...path]`

## Firebase Migration
Firebase modules are replaced via webpack aliases in `next.config.ts`:
- `firebase/firestore` → `src/lib/firestore-shim.ts`
- `firebase/auth` → `src/lib/auth-shim.ts`
- `firebase/storage` → `src/lib/storage-shim.ts`
- `firebase/app` → `src/lib/app-shim.ts`

The `src/firebase/` module re-exports from the shims, so components importing `@/firebase` work unchanged.

## Setup
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
This starts PostgreSQL and the Next.js dev server, runs Prisma migrations and seeds, and serves on port 3000.

## Default Users
- `admin@beanespress.com` / `password` (admin role)
- `stockman@beanespress.com` / `password` (stock-manager role)
- `kitchen@beanespress.com` / `password` (kitchen-user role)
- `bar@beanespress.com` / `password` (bar-user role)

## Role-Based Access Control
- **admin**: Full access to all pages
- **stock-manager**: Stock Manager page + Settings (profile only) only
- **kitchen-user**: Kitchen KDS page + Settings (profile only) only
- **bar-user**: Bar KDS page + Settings (profile only) only
- Legacy `manager` and `user` roles are removed from the UI but existing DB records are preserved; users with those roles are redirected to login.

## Key Files
- `prisma/schema.prisma` — database schema
- `prisma/seed.mjs` — seed data
- `src/lib/firestore-shim.ts` — Firestore API replacement
- `src/lib/auth-shim.ts` — Firebase Auth replacement
- `src/lib/storage-shim.ts` — Firebase Storage replacement
- `src/lib/fake-timestamp.ts` — Timestamp class mimicking Firestore Timestamp
- `src/app/api/` — all API routes
- `src/firebase/` — compatibility layer re-exporting shimmed functions

## Verification
1. Login at `/login` with `admin@beanespress.com` / `password`
2. Dashboard should load with seeded items and categories
3. Navigate to POS (`/sales`), Items (`/items`), Stock (`/stock`), etc.

## Tech Notes
- Dates are stored as PostgreSQL `DateTime` and serialized as `{ __timestamp, seconds, nanoseconds }` objects in API responses. The `FakeTimestamp` class (aliased as `Timestamp`) converts these back so existing `.toDate()` calls work.
- The `settings` collection stores data in a JSON `data` column; the API flattens it on read and wraps it on write for compatibility with existing component code.
- SWR provides real-time-like updates via revalidation-on-focus and short deduping intervals.
