import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const db = getDb();
  db.subcategories = db.subcategories.filter((s) => s.id !== id);
  db.items.forEach((i) => {
    if (i.subcategoryId === id) i.subcategoryId = null;
  });
  persist();
  return NextResponse.json({ ok: true });
}
