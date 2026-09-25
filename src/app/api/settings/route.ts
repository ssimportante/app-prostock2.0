import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import type { PosSettings } from '@/lib/types';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const db = getDb();
  return NextResponse.json({ settings: db.settings, taxes: db.taxes });
}

export async function PATCH(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const db = getDb();
  const next: PosSettings = {
    currency: body.currency !== undefined ? String(body.currency).slice(0, 4) : db.settings.currency,
    defaultSaleType:
      body.defaultSaleType === 'take-away' || body.defaultSaleType === 'dine-in'
        ? body.defaultSaleType
        : db.settings.defaultSaleType,
  };
  db.settings = next;
  persist();
  return NextResponse.json({ settings: next, taxes: db.taxes });
}
