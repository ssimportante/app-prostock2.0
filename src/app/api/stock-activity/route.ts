import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import type { ActivityEntry } from '@/lib/types';

export async function GET() {
  const gate = await apiGuard(['admin', 'manager', 'stock-manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const db = getDb();
  const entries: ActivityEntry[] = [
    ...db.stockReceipts.map((r) => ({ kind: 'receipt' as const, ...r })),
    ...db.wasteEvents.map((w) => ({ kind: 'waste' as const, ...w })),
  ];
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json({ entries: entries.slice(0, 300) });
}
