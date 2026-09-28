import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';
import { roundTo } from '@/lib/utils';

// FIFO deduction helper
function deductFromBatches(batches: any[], quantityToDeduct: number, itemName: string): any[] {
  let totalStock = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  totalStock = roundTo(totalStock);

  if (totalStock < quantityToDeduct) {
    throw new Error(`Not enough stock for ${itemName}. Required: ${quantityToDeduct}, Available: ${totalStock}.`);
  }

  const sortedBatches = [...batches].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return 0;
  });

  let remainingToDeduct = Number(quantityToDeduct);
  for (const batch of sortedBatches) {
    if (remainingToDeduct <= 0) break;
    const currentBatchQty = Number(batch.quantity || 0);
    const deductFromThisBatch = Math.min(remainingToDeduct, currentBatchQty);
    batch.quantity = roundTo(currentBatchQty - deductFromThisBatch);
    remainingToDeduct = roundTo(remainingToDeduct - deductFromThisBatch);
  }

  return batches.filter((b) => Number(b.quantity) > 0);
}

// POST /api/stock/waste - record waste with stock deduction
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { itemId, batchId, quantity, reason, recordedByName, eventType } = body;

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const qty = roundTo(quantity);
    const itemUpdates = new Map<string, any[]>();
    let wasteBatchId: string | undefined;

    if (item.inventoryType === 'simple' && item.trackStock) {
      const batches = JSON.parse(JSON.stringify(item.stockBatches as any[]));

      if (batchId) {
        // Deduct from specific batch
        const batchIndex = batches.findIndex((b: any) => b.id === batchId);
        if (batchIndex === -1) {
          return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }
        const batch = batches[batchIndex];
        const newQty = roundTo(Number(batch.quantity || 0) - qty);
        if (newQty < 0) {
          return NextResponse.json({ error: 'Not enough stock in selected batch' }, { status: 400 });
        }
        if (newQty > 0) {
          batches[batchIndex] = { ...batch, quantity: newQty };
        } else {
          batches.splice(batchIndex, 1);
        }
        wasteBatchId = batchId;
      } else {
        // FIFO deduction
        const updated = deductFromBatches(batches, qty, item.name);
        wasteBatchId = (item.stockBatches as any[]).find((b) => b.id === updated[0]?.id)?.id;
      }
      itemUpdates.set(item.id, batches);
    } else if (item.inventoryType === 'composite' && item.components) {
      const components = item.components as any[];
      for (const comp of components) {
        const compItem = await prisma.item.findUnique({ where: { id: comp.itemId } });
        if (compItem && compItem.trackStock) {
          const batches = JSON.parse(JSON.stringify(compItem.stockBatches as any[]));
          const updated = deductFromBatches(batches, comp.quantity * qty, compItem.name);
          itemUpdates.set(compItem.id, updated);
        }
      }
    }

    const wasteId = `waste-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const cost = roundTo(qty * item.cost);

    await prisma.$transaction(async (tx) => {
      for (const [itemId, batches] of itemUpdates) {
        await tx.item.update({
          where: { id: itemId },
          data: { stockBatches: batches },
        });
      }
      await tx.wasteEvent.create({
        data: {
          id: wasteId,
          date: new Date(),
          itemId,
          itemName: item.name,
          quantity: qty,
          cost,
          unit: item.soldBy === 'volume' ? 'g/ml' : 'units',
          userId: user.uid,
          recordedByName: recordedByName || '',
          batchId: wasteBatchId,
          reason: reason || '',
          eventType: eventType || 'waste',
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
