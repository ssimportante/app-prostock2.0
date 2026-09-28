import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

// PUT /api/items/bulk - bulk update items
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { itemIds, data } = await req.json();
    const updateData: any = {};
    if (data.stationId !== undefined) updateData.stationId = data.stationId;
    if (data.isSellable !== undefined) updateData.isSellable = data.isSellable;
    if (data.trackStock !== undefined) updateData.trackStock = data.trackStock;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.inventoryType !== undefined) updateData.inventoryType = data.inventoryType;

    await prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: updateData,
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/items/bulk - bulk delete items (using POST with body for ids)
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { itemIds } = await req.json();

    // Get items to update category counts
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, categoryId: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      // Decrement category counts
      const categoryCounts = new Map<string, number>();
      for (const item of items) {
        categoryCounts.set(item.categoryId, (categoryCounts.get(item.categoryId) || 0) + 1);
      }
      for (const [catId, count] of categoryCounts) {
        await tx.category.update({
          where: { id: catId },
          data: { itemCount: { decrement: count } },
        }).catch(() => {});
      }
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/items/bulk - bulk add/remove tags
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { itemIds, tagsToRemove } = await req.json();
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const currentTags = (item.tags as string[]) || [];
        const updatedTags = currentTags.filter((t) => !tagsToRemove.includes(t));
        if (updatedTags.length !== currentTags.length) {
          await tx.item.update({
            where: { id: item.id },
            data: { tags: updatedTags },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
