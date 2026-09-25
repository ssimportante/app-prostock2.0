import { NextResponse, type NextRequest } from 'next/server';
import { getDb, newId, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ taxes: getDb().taxes });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const rate = Number(body.rate);
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!(rate >= 0 && rate <= 100)) {
    return NextResponse.json({ error: 'Rate must be between 0 and 100' }, { status: 400 });
  }
  const db = getDb();
  const tax = { id: newId('tax'), name, rate };
  db.taxes.push(tax);
  persist();
  return NextResponse.json({ tax });
}
