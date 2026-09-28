import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../../items/route';

// PUT /api/items/bulk/tags - add tags to items
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { itemIds, tagsToAdd } = await req.json();
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const currentTags = (item.tags as string[]) || [];
        const newTags = [...new Set([...currentTags, ...tagsToAdd])];
        await tx.item.update({
          where: { id: item.id },
          data: { tags: newTags },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
