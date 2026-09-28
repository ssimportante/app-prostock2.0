import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';

// DELETE /api/items/[id]/batches - delete a stock batch from an item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const batches = item.stockBatches as any[];
    const updatedBatches = batches.filter((b) => b.id !== batchId);

    await prisma.item.update({
      where: { id },
      data: { stockBatches: updatedBatches },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
