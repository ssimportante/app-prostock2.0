import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { itemFromPayload } from '../item-payload';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const db = getDb();
  const existing = db.items.find((i) => i.id === id);
  if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { item, error } = itemFromPayload({ ...existing, ...body });
  if (error) return NextResponse.json({ error }, { status: 400 });

  // Composite items must not reference themselves.
  if (item.components.some((c) => c.itemId === id)) {
    return NextResponse.json({ error: 'An item cannot be a component of itself' }, { status: 400 });
  }

  Object.assign(existing, item);
  persist();
  return NextResponse.json({ item: existing });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin', 'manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const db = getDb();
  const usedIn = db.items.find((i) => i.components.some((c) => c.itemId === id));
  if (usedIn) {
    return NextResponse.json(
      { error: `This item is used in the recipe for ${usedIn.name}` },
      { status: 409 }
    );
  }
  const index = db.items.findIndex((i) => i.id === id);
  if (index === -1) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  db.items.splice(index, 1);
  persist();
  return NextResponse.json({ ok: true });
}
