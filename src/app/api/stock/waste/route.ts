import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { logWaste } from '@/server/stock';

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager', 'stock-manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const quantity = Number(body.quantity);
  if (!body.itemId || !(quantity > 0)) {
    return NextResponse.json({ error: 'Item and a positive quantity are required' }, { status: 400 });
  }
  const eventType = body.eventType === 'pull-out' ? 'pull-out' : 'waste';

  try {
    const db = getDb();
    const event = logWaste(db, gate.user, {
      itemId: String(body.itemId),
      quantity,
      reason: String(body.reason ?? ''),
      eventType,
    });
    persist();
    return NextResponse.json({ event });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to log waste' }, { status: 400 });
  }
}
