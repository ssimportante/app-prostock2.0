import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/wasteEvents - list all, optional ?orderBy=desc
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderBy = searchParams.get('orderBy');
  const events = await prisma.wasteEvent.findMany({
    orderBy: { date: orderBy === 'asc' ? 'asc' : 'desc' },
  });
  return NextResponse.json(events);
}
