import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';
import { roundTo } from '@/lib/utils';

// DELETE /api/stockReceipts/[id] - delete receipt and remove stock from item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const receipt = await prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

    const item = await prisma.item.findUnique({ where: { id: receipt.itemId } });
    if (item && item.trackStock) {
      const batches = item.stockBatches as any[];
      const batchIndex = batches.findIndex((b) => b.id === receipt.batchId);

      if (batchIndex !== -1) {
        const batch = batches[batchIndex];
        const newQty = roundTo(Number(batch.quantity || 0) - Number(receipt.quantity));
        if (newQty > 0) {
          batches[batchIndex] = { ...batch, quantity: newQty };
        } else {
          batches.splice(batchIndex, 1);
        }
        await prisma.item.update({
          where: { id: item.id },
          data: { stockBatches: batches },
        });
      }
    }

    await prisma.stockReceipt.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
