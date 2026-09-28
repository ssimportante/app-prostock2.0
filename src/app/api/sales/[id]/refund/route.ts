import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';
import { roundTo } from '@/lib/utils';

// PUT /api/sales/[id]/refund - refund items from a sale
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const { itemIndex, refundQty } = await req.json();

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

    const saleItems = sale.items as any[];
    const targetItem = saleItems[itemIndex];
    if (!targetItem) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const item = await prisma.item.findUnique({ where: { id: targetItem.itemId } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const itemUpdates = new Map<string, any[]>();

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

    if (item.inventoryType === 'simple' && item.trackStock) {
      itemUpdates.set(item.id, restoreStock(item.stockBatches as any[], refundQty));
    } else if (item.inventoryType === 'composite' && item.components) {
      const components = item.components as any[];
      for (const comp of components) {
        const compItem = await prisma.item.findUnique({ where: { id: comp.itemId } });
        if (compItem && compItem.trackStock) {
          itemUpdates.set(compItem.id, restoreStock(compItem.stockBatches as any[], comp.quantity * refundQty));
        }
      }
    }

    // Update sale item refundedQuantity
    const updatedSaleItems = [...saleItems];
    updatedSaleItems[itemIndex] = {
      ...targetItem,
      refundedQuantity: (targetItem.refundedQuantity || 0) + refundQty,
    };

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id },
        data: { items: updatedSaleItems },
      });
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
