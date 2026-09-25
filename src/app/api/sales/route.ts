import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { createSale } from '@/server/sales';
import type { LineInput, TicketDiscountInput } from '@/lib/checkout-math';
import type { SaleType } from '@/lib/types';

export async function GET() {
  const gate = await apiGuard();
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const db = getDb();
  const sales = [...db.sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json({ sales: sales.slice(0, 300) });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin', 'manager', 'user']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const db = getDb();
  const saleType: SaleType = body.saleType === 'take-away' ? 'take-away' : db.settings.defaultSaleType;

  const lines: LineInput[] = Array.isArray(body.items)
    ? (body.items as { itemId?: unknown; quantity?: unknown; discount?: unknown }[])
        .filter((l) => l.itemId && Number(l.quantity) > 0)
        .map((l) => ({
          itemId: String(l.itemId),
          quantity: Number(l.quantity),
          ...(l.discount && (l.discount as { type?: string; value?: number }).value > 0
            ? { discount: l.discount as { type: 'percent' | 'fixed'; value: number } }
            : {}),
        }))
    : [];

  let discount: TicketDiscountInput | undefined;
  if (body.discount && Number(body.discount.value) > 0) {
    discount = {
      type: body.discount.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(body.discount.value),
    };
  }

  try {
    const sale = createSale(
      db,
      {
        lines,
        discount,
        deliveryFee: Math.max(0, Math.round(Number(body.deliveryFee) || 0)),
        saleType,
        userId: gate.user.id,
        userName: gate.user.name,
      },
      { status: 'pending' }
    );
    persist();
    return NextResponse.json({ sale });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 400 }
    );
  }
}
