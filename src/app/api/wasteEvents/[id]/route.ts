import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';
import { roundTo } from '@/lib/utils';

// DELETE /api/wasteEvents/[id] - delete waste event and restore stock
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const wasteEvent = await prisma.wasteEvent.findUnique({ where: { id } });
    if (!wasteEvent) return NextResponse.json({ error: 'Waste event not found' }, { status: 404 });

    const item = await prisma.item.findUnique({ where: { id: wasteEvent.itemId } });
    if (item && item.trackStock) {
      const batches = item.stockBatches as any[];

      if (wasteEvent.batchId) {
        const batchIndex = batches.findIndex((b) => b.id === wasteEvent.batchId);
        if (batchIndex !== -1) {
          batches[batchIndex] = {
            ...batches[batchIndex],
            quantity: roundTo(Number(batches[batchIndex].quantity || 0) + Number(wasteEvent.quantity)),
          };
        } else {
          batches.push({
            id: wasteEvent.batchId,
            quantity: roundTo(Number(wasteEvent.quantity)),
            purchaseDate: new Date().toISOString().split('T')[0],
          });
        }
      } else {
        if (batches.length > 0) {
          batches[0] = { ...batches[0], quantity: roundTo(Number(batches[0].quantity || 0) + Number(wasteEvent.quantity)) };
        } else {
          batches.push({
            id: `restored-${Date.now()}`,
            quantity: roundTo(Number(wasteEvent.quantity)),
            purchaseDate: new Date().toISOString().split('T')[0],
          });
        }
      }

      await prisma.item.update({
        where: { id: item.id },
        data: { stockBatches: batches },
      });
    }

    await prisma.wasteEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
