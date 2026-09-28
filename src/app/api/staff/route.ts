import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../items/route';

export async function GET() {
  const staff = await prisma.staff.findMany();
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const id = `staff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const staff = await prisma.staff.create({
    data: { id, name: body.name },
  });
  return NextResponse.json(staff);
}
