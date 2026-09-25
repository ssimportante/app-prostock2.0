import { NextResponse, type NextRequest } from 'next/server';
import { getDb, newId, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ stations: getDb().stations });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const db = getDb();
  const station = { id: newId('st'), name };
  db.stations.push(station);
  persist();
  return NextResponse.json({ station });
}
