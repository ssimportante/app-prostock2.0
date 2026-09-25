import { NextResponse, type NextRequest } from 'next/server';
import { getDb, newId, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ categories: getDb().categories });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color ?? '')) ? String(body.color) : '#B4552D';

  const db = getDb();
  if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
  }
  const category = { id: newId('cat'), name, color };
  db.categories.push(category);
  persist();
  return NextResponse.json({ category });
}
