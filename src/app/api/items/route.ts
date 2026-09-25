import { NextResponse, type NextRequest } from 'next/server';
import { getDb, newId, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { itemFromPayload } from './item-payload';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ items: getDb().items });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const { item, error } = itemFromPayload(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const db = getDb();
  const created = { id: newId('item'), ...item };
  db.items.push(created);
  persist();
  return NextResponse.json({ item: created });
}
