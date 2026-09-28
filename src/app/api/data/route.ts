import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';
import { roundTo } from '@/lib/utils';

// POST /api/data - data management operations
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { type, targetItemId } = await req.json();

    if (type === 'reset-stock') {
      await prisma.item.updateMany({ data: { stockBatches: [] } });
      return NextResponse.json({ success: true, message: 'All stock batches cleared.' });
    }

    if (type === 'reset-receipts') {
      await prisma.stockReceipt.deleteMany({});
      return NextResponse.json({ success: true, message: 'Stock activity log cleared.' });
    }

    if (type === 'reset-waste') {
      await prisma.wasteEvent.deleteMany({});
      return NextResponse.json({ success: true, message: 'Waste events deleted.' });
    }

    if (type === 'normalize') {
      const items = await prisma.item.findMany();
      for (const item of items) {
        const batches = item.stockBatches as any[];
        if (batches && batches.length > 0) {
          const clean = batches.map((b) => ({ ...b, quantity: roundTo(Number(b.quantity || 0)) }));
          await prisma.item.update({ where: { id: item.id }, data: { stockBatches: clean } });
        }
      }
      return NextResponse.json({ success: true, message: 'Normalization complete.' });
    }

    if (type === 'reconcile') {
      const count = await runGlobalInventoryReconciliation(targetItemId);
      return NextResponse.json({ success: true, count, message: `Audited ${count} items.` });
    }

    return NextResponse.json({ error: 'Unknown operation type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function runGlobalInventoryReconciliation(targetItemId?: string): Promise<number> {
  const items = await prisma.item.findMany();
  const sales = await prisma.sale.findMany();
  const receipts = await prisma.stockReceipt.findMany();
  const wasteEvents = await prisma.wasteEvent.findMany();

  const itemsMap = new Map(items.map((i) => [i.id, i]));
  let updateCount = 0;

  for (const [itemId, item] of itemsMap.entries()) {
    if (!item.trackStock) continue;
    if (targetItemId && itemId !== targetItemId) continue;

    // 1. Rebuild Original Batches from Receipts Log
    const originalBatchesFromLogs = receipts
      .filter((r) => r.itemId === itemId)
      .map((r) => {
        const b: any = {
          id: r.batchId || r.id,
          quantity: Number(r.quantity || 0),
          purchaseDate: r.date.toISOString().split('T')[0],
        };
        const bd = r.batchDetails as any;
        if (bd?.date) {
          if (bd.dateType === 'expiry') b.expiryDate = bd.date;
          if (bd.dateType === 'roast') b.roastDate = bd.date;
        }
        return b;
      })
      .sort((a, b) => {
        const dateA = a.expiryDate || a.purchaseDate || '9999-12-31';
        const dateB = b.expiryDate || b.purchaseDate || '9999-12-31';
        return dateA.localeCompare(dateB);
      });

    // 2. Calculate Total Historical Outgoing (Sales + Proportional Waste)
    let totalConsumption = 0;

    for (const sale of sales) {
      const saleItems = sale.items as any[];
      for (const si of saleItems) {
        const product = itemsMap.get(si.itemId);
        if (!product) continue;
        const effectiveQty = Number(si.quantity || 0) - Number(si.refundedQuantity || 0);
        if (effectiveQty <= 0) continue;

        if (si.itemId === itemId) {
          totalConsumption += effectiveQty;
        } else if (product.inventoryType === 'composite' && product.components) {
          const usage = (product.components as any[]).find((c) => c.itemId === itemId);
          if (usage) {
            const yieldVal = product.yield || 1;
            totalConsumption += Number(usage.quantity) * (effectiveQty / yieldVal);
          }
        }
      }
    }

    // Add direct and proportional waste
    for (const waste of wasteEvents) {
      const wastedItem = itemsMap.get(waste.itemId);
      if (!wastedItem) continue;

      if (waste.itemId === itemId) {
        totalConsumption += Number(waste.quantity || 0);
      } else if (wastedItem.inventoryType === 'composite' && wastedItem.components) {
        const usage = (wastedItem.components as any[]).find((c) => c.itemId === itemId);
        if (usage) {
          const yieldVal = wastedItem.yield || 1;
          totalConsumption += Number(usage.quantity) * (Number(waste.quantity) / yieldVal);
        }
      }
    }

    let remainingToDeduct = roundTo(totalConsumption);

    // 3. Apply FIFO Deduction
    const resultingBatches: any[] = [];
    for (const b of originalBatchesFromLogs) {
      if (remainingToDeduct > 0) {
        const deduct = Math.min(b.quantity, remainingToDeduct);
        const left = roundTo(b.quantity - deduct);
        remainingToDeduct = roundTo(remainingToDeduct - deduct);
        if (left > 0) {
          resultingBatches.push({ ...b, quantity: left });
        }
      } else {
        resultingBatches.push(b);
      }
    }

    await prisma.item.update({
      where: { id: itemId },
      data: { stockBatches: resultingBatches },
    });
    updateCount++;
  }

  return updateCount;
}
