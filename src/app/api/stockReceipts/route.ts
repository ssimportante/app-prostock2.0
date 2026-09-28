import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';

// GET /api/stockReceipts - list all, optional ?orderBy=desc
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderBy = searchParams.get('orderBy');
  const receipts = await prisma.stockReceipt.findMany({
    orderBy: { date: orderBy === 'asc' ? 'asc' : 'desc' },
  });
  return NextResponse.json(receipts);
}
