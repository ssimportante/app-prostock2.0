import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '../../items/route';

// PUT /api/users/[id]/profile - update user profile (name, photoURL)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.photoURL !== undefined) data.photoURL = body.photoURL;
  const updated = await prisma.user.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}
