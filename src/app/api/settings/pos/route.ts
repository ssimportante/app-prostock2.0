import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/settings/pos
export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 'pos' } });
  return NextResponse.json(settings || { id: 'pos', defaultSaleType: 'dine-in', currency: 'USD' });
}

// PUT /api/settings/pos
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const settings = await prisma.settings.upsert({
    where: { id: 'pos' },
    update: {
      defaultSaleType: body.defaultSaleType,
      currency: body.currency,
    },
    create: {
      id: 'pos',
      defaultSaleType: body.defaultSaleType || 'dine-in',
      currency: body.currency || 'USD',
    },
  });
  return NextResponse.json(settings);
}
