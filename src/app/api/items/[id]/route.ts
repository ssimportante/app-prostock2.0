import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, computeItemCost } from '../route';

// GET /api/items/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

// PUT /api/items/[id] - update item
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const { initialQuantity, initialExpiryDate, initialPurchaseDate, initialRoastDate, ...restOfData } = body;

    // Get existing item to check category change
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const calculatedCost = await computeItemCost(restOfData, id);

    const dataForDb: any = {
      name: restOfData.name,
      description: restOfData.description || '',
      categoryId: restOfData.categoryId,
      subcategoryId: restOfData.subcategoryId || null,
      stationId: restOfData.stationId || '',
      sku: restOfData.sku || '',
      barcode: restOfData.barcode || '',
      isSellable: restOfData.isSellable ?? false,
      saleType: restOfData.saleType ?? null,
      itemType: restOfData.isSellable ? (restOfData.itemType || null) : null,
      beverageSize: restOfData.isSellable && restOfData.itemType === 'beverage' ? (restOfData.beverageSize || null) : null,
      soldBy: restOfData.soldBy || 'each',
      price: Number(restOfData.price) || 0,
      cost: calculatedCost,
      marketPrice: restOfData.marketPrice ?? null,
      purchaseQuantity: restOfData.purchaseQuantity ?? null,
      inventoryType: restOfData.inventoryType || 'simple',
      trackStock: restOfData.trackStock ?? false,
      lowStockThreshold: Number(restOfData.lowStockThreshold) || 0,
      components: restOfData.components || [],
      yield: restOfData.yield ?? null,
      tags: restOfData.tags || [],
      taxIds: restOfData.taxIds || [],
      posRepresentationType: restOfData.posRepresentationType || 'color',
      posColor: restOfData.posColor || '#cccccc',
      imageUrl: restOfData.imageUrl ?? existing.imageUrl,
    };

    const updated = await prisma.item.update({
      where: { id },
      data: dataForDb,
    });

    // Update category itemCount if category changed
    if (existing.categoryId !== dataForDb.categoryId) {
      await prisma.category.update({
        where: { id: existing.categoryId },
        data: { itemCount: { decrement: 1 } },
      }).catch(() => {});
      await prisma.category.update({
        where: { id: dataForDb.categoryId },
        data: { itemCount: { increment: 1 } },
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/items/[id] - delete item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.item.delete({ where: { id } });
    await prisma.category.update({
      where: { id: item.categoryId },
      data: { itemCount: { decrement: 1 } },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
