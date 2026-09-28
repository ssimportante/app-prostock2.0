import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';
import { roundTo } from '@/lib/utils';

// POST /api/stock/receive - receive new stock
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { itemId, quantity, purchaseDate, dateType, date } = body;

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const qty = roundTo(quantity);
    const newBatch: any = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      quantity: qty,
      purchaseDate: purchaseDate
        ? new Date(purchaseDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    };

    if (date && dateType !== 'none') {
      const isoDate = new Date(date).toISOString().split('T')[0];
      if (dateType === 'expiry') {
        newBatch.expiryDate = isoDate;
      } else if (dateType === 'roast') {
        newBatch.roastDate = isoDate;
      }
    }

    const existingBatches = item.stockBatches as any[];
    const updatedBatches = [...existingBatches, newBatch];

    const batchDetails: any = {};
    if (newBatch.expiryDate) {
      batchDetails.date = newBatch.expiryDate;
      batchDetails.dateType = 'expiry';
    } else if (newBatch.roastDate) {
      batchDetails.date = newBatch.roastDate;
      batchDetails.dateType = 'roast';
    }

    const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    await prisma.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: itemId },
        data: { stockBatches: updatedBatches },
      });
      await tx.stockReceipt.create({
        data: {
          id: receiptId,
          date: purchaseDate ? new Date(purchaseDate) : new Date(),
          userId: user.uid,
          itemId,
          itemName: item.name,
          quantity: qty,
          unit: item.soldBy === 'volume' ? 'g/ml' : 'units',
          batchId: newBatch.id,
          batchDetails,
        },
      });
    });

    return NextResponse.json({ success: true, batchId: newBatch.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
