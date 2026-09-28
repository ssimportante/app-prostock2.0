import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';
import { roundTo } from '@/lib/utils';

// DELETE /api/sales/[id] - reverse sale and restore stock
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const saleItems = sale.items as any[];
    const itemIds = new Set<string>(saleItems.map((si) => si.itemId));
    const allItems = await prisma.item.findMany({ where: { id: { in: Array.from(itemIds) } } });
    const itemMap = new Map(allItems.map((i) => [i.id, i]));

    const restoreStock = (batches: any[], qty: number): any[] => {
      const updated = [...batches];
      if (updated.length > 0) {
        updated[0] = { ...updated[0], quantity: roundTo(Number(updated[0].quantity || 0) + Number(qty)) };
      } else {
        updated.push({
          id: `restored-${Date.now()}`,
          quantity: roundTo(Number(qty)),
          purchaseDate: new Date().toISOString().split('T')[0],
        });
      }
      return updated;
    };

    const itemUpdates = new Map<string, any[]>();

    for (const saleItem of saleItems) {
      const item = itemMap.get(saleItem.itemId);
      if (!item) continue;

      if (item.inventoryType === 'simple' && item.trackStock) {
        if (!itemUpdates.has(item.id)) {
          itemUpdates.set(item.id, JSON.parse(JSON.stringify(item.stockBatches as any[])));
        }
        const restored = restoreStock(itemUpdates.get(item.id), saleItem.quantity);
        itemUpdates.set(item.id, restored);
      } else if (item.inventoryType === 'composite' && item.components) {
        const components = item.components as any[];
        for (const comp of components) {
          const compItem = itemMap.get(comp.itemId);
          if (compItem && compItem.trackStock) {
            if (!itemUpdates.has(compItem.id)) {
              itemUpdates.set(compItem.id, JSON.parse(JSON.stringify(compItem.stockBatches as any[])));
            }
            const restored = restoreStock(itemUpdates.get(compItem.id), comp.quantity * saleItem.quantity);
            itemUpdates.set(compItem.id, restored);
          }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.delete({ where: { id } });
      for (const [itemId, batches] of itemUpdates) {
        await tx.item.update({
          where: { id: itemId },
          data: { stockBatches: batches },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
