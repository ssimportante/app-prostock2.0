import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

export async function GET() {
  const taxes = await prisma.tax.findMany();
  return NextResponse.json(taxes);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const id = `tax-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const tax = await prisma.tax.create({
    data: {
      id,
      name: body.name,
      rate: Number(body.rate) || 0,
      taxType: body.taxType ?? null,
    },
  });
  return NextResponse.json(tax);
}
