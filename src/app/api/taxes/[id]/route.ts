import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const db = getDb();
  db.taxes = db.taxes.filter((t) => t.id !== id);
  db.items.forEach((i) => {
    i.taxIds = (i.taxIds ?? []).filter((taxId) => taxId !== id);
  });
  persist();
  return NextResponse.json({ ok: true });
}
