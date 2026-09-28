import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

// DELETE /api/tags/[name] - delete a tag from all items
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { name } = await params;
    const items = await prisma.item.findMany();

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const tags = (item.tags as string[]) || [];
        if (tags.includes(name)) {
          const updatedTags = tags.filter((t) => t !== name);
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
