import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

export async function GET() {
  const subcategories = await prisma.subcategory.findMany();
  return NextResponse.json(subcategories);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const subcategory = await prisma.subcategory.create({
    data: { id, name: body.name, categoryId: body.categoryId },
  });
  return NextResponse.json(subcategory);
}
