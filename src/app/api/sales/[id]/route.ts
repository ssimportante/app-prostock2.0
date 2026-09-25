import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { canTransitionTo } from '@/server/sales';
import type { SaleStatus } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

const STATUSES: SaleStatus[] = ['pending', 'preparing', 'completed', 'cancelled'];

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const db = getDb();
  const sale = db.sales.find((s) => s.id === id);
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  if (!canTransitionTo(sale.status, body.status)) {
    return NextResponse.json({ error: `Cannot move a ${sale.status} ticket to ${body.status}` }, { status: 400 });
  }

  sale.status = body.status;
  sale.completedAt = body.status === 'completed' || body.status === 'cancelled' ? new Date().toISOString() : null;
  persist();
  return NextResponse.json({ sale });
}
