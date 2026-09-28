import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';
import { roundTo } from '@/lib/utils';

// GET /api/sales - list sales, optional ?limit=N&orderBy=desc
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit');
  const orderBy = searchParams.get('orderBy');
  const status = searchParams.get('status');

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const findMany: any = {
    where,
    orderBy: { date: orderBy === 'asc' ? 'asc' : 'desc' },
  };
  if (limit) {
    findMany.take = parseInt(limit, 10);
  }

  const sales = await prisma.sale.findMany(findMany);
  return NextResponse.json(sales);
}

// FIFO stock deduction helper
function deductStockFromBatches(batches: any[], quantityToDeduct: number, itemName: string): any[] {
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

// POST /api/sales - create sale with FIFO stock deduction
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const saleData = await req.json();

    // Get all items that need stock updates
    const itemIds = new Set<string>();
    for (const saleItem of saleData.items) {
      itemIds.add(saleItem.itemId);
    }
    const items = await prisma.item.findMany({ where: { id: { in: Array.from(itemIds) } } });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Compute stock updates
    const itemUpdates = new Map<string, any[]>();

    for (const saleItem of saleData.items) {
      const item = itemMap.get(saleItem.itemId);
      if (!item) continue;

      if (item.inventoryType === 'simple' && item.trackStock) {
        const batches = item.stockBatches as any[];
        if (!itemUpdates.has(item.id)) {
          itemUpdates.set(item.id, JSON.parse(JSON.stringify(batches)));
        }
        const updatedBatches = deductStockFromBatches(itemUpdates.get(item.id), saleItem.quantity, item.name);
        itemUpdates.set(item.id, updatedBatches);
      } else if (item.inventoryType === 'composite' && item.components) {
        const components = item.components as any[];
        for (const comp of components) {
          const compItem = itemMap.get(comp.itemId);
          if (compItem && compItem.trackStock) {
            if (!itemUpdates.has(compItem.id)) {
              itemUpdates.set(compItem.id, JSON.parse(JSON.stringify(compItem.stockBatches as any[])));
            }
            const deductQty = comp.quantity * saleItem.quantity;
            const updatedBatches = deductStockFromBatches(itemUpdates.get(compItem.id), deductQty, compItem.name);
            itemUpdates.set(compItem.id, updatedBatches);
          }
        }
      }
    }

    // Generate sale ID and ticket number
    const saleId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ticketNumber = saleData.ticketNumber || Math.floor(100 + Math.random() * 900).toString();

    const sanitizedItems = saleData.items.map((item: any) => {
      const sanitizedItem: any = {
        itemId: item.itemId,
        quantity: Number(item.quantity),
        price: Number(item.price),
      };
      if (item.discount) {
        sanitizedItem.discount = {
          type: item.discount.type,
          value: Number(item.discount.value),
          amount: Number(item.discount.amount),
        };
      }
      return sanitizedItem;
    });

    const saleRecord: any = {
      id: saleId,
      date: new Date(saleData.date),
      total: Number(saleData.total),
      subtotal: Number(saleData.subtotal || saleData.total),
      userId: saleData.userId || null,
      status: saleData.status || 'pending',
      ticketNumber,
      items: sanitizedItems,
    };

    if (saleData.discount) {
      saleRecord.discount = {
        type: saleData.discount.type,
        value: Number(saleData.discount.value),
        amount: Number(saleData.discount.amount),
      };
    }

    if (saleData.deliveryFee !== undefined && saleData.deliveryFee !== null) {
      saleRecord.deliveryFee = Number(saleData.deliveryFee);
    }

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      await tx.sale.create({ data: saleRecord });
      for (const [itemId, batches] of itemUpdates) {
        await tx.item.update({
          where: { id: itemId },
          data: { stockBatches: batches },
        });
      }
    });

    return NextResponse.json({ id: saleId, ...saleRecord });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
