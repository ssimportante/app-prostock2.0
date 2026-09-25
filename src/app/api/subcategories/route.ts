import { NextResponse, type NextRequest } from 'next/server';
import { getDb, newId, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json({ subcategories: getDb().subcategories });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const categoryId = String(body.categoryId ?? '').trim();
  if (!name || !categoryId) {
    return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
  }
  const db = getDb();
  if (!db.categories.some((c) => c.id === categoryId)) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }
  const subcategory = { id: newId('sub'), name, categoryId };
  db.subcategories.push(subcategory);
  persist();
  return NextResponse.json({ subcategory });
}
