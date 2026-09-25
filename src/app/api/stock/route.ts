import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { totalStock, unitFor } from '@/server/stock';
import type { StockOverviewRow } from '@/lib/types';

export async function GET() {
  const gate = await apiGuard(['admin', 'manager', 'stock-manager']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const db = getDb();
  const rows: StockOverviewRow[] = db.items
    .filter((i) => i.trackStock)
    .map((i) => ({
      id: i.id,
      name: i.name,
      categoryId: i.categoryId,
      stock: Math.round(totalStock(i) * 1000) / 1000,
      unit: unitFor(i),
      lowStockThreshold: i.lowStockThreshold,
      value: Math.round(totalStock(i) * i.cost),
      batches: (i.stockBatches ?? []).slice().sort((a, b) => {
        const key = (x: { expiryDate?: string; roastDate?: string; addedAt: string }) =>
          x.expiryDate ?? x.roastDate ?? x.addedAt;
        return key(a).localeCompare(key(b));
      }),
    }));

  return NextResponse.json({ rows });
}
