import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/sales/[id]/status - update sale status (for KDS)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const data: any = { status: body.status };
  if (body.status === 'completed') {
    data.completedAt = new Date();
  }
  const updated = await prisma.sale.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}
