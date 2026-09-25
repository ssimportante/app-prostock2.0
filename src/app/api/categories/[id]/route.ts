import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const db = getDb();
  if (db.items.some((i) => i.categoryId === id)) {
    return NextResponse.json({ error: 'This category is used by items' }, { status: 409 });
  }
  db.subcategories = db.subcategories.filter((s) => s.categoryId !== id);
  db.categories = db.categories.filter((c) => c.id !== id);
  persist();
  return NextResponse.json({ ok: true });
}
