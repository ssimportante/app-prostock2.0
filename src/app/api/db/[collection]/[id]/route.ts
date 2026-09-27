import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-server';
import { serializeForClient } from '@/lib/serialize';

const COLLECTION_MAP: Record<string, keyof typeof prisma> = {
  items: 'item',
  categories: 'category',
  subcategories: 'subcategory',
  stations: 'station',
  sales: 'sale',
  wasteEvents: 'wasteEvent',
  stockReceipts: 'stockReceipt',
  taxes: 'tax',
  settings: 'setting',
  users: 'user',
};

function getModel(collection: string) {
  const delegate = COLLECTION_MAP[collection];
  if (!delegate) return null;
  return (prisma as any)[delegate];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { collection, id } = await params;
  const model = getModel(collection);
  if (!model) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  try {
    const record = await model.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (collection === 'users') {
      delete (record as any).passwordHash;
    }
    if (collection === 'settings') {
      const d = (record as any).data;
      delete (record as any).data;
      Object.assign(record, d);
    }
    return NextResponse.json({ data: serializeForClient(record) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { collection, id } = await params;
  const model = getModel(collection);
  if (!model) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let data: any = body;
    if (collection === 'settings') {
      data = { data: body };
    }
    // Use upsert to handle both create and update (mimics setDoc behavior)
    const record = await model.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    return NextResponse.json({ data: serializeForClient(record) });
  } catch (error: any) {
    console.error(`PUT /api/db/${collection}/${id} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  const { collection, id } = await params;
  const model = getModel(collection);
  if (!model) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await model.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
