import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

export async function GET() {
  const categories = await prisma.category.findMany();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const category = await prisma.category.create({
    data: {
      id,
      name: body.name,
      color: body.color || '',
      itemCount: 0,
    },
  });
  return NextResponse.json(category);
}
