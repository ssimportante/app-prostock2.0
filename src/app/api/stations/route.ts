import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

export async function GET() {
  const stations = await prisma.station.findMany();
  return NextResponse.json(stations);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const id = `sta-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const station = await prisma.station.create({
    data: { id, name: body.name },
  });
  return NextResponse.json(station);
}
