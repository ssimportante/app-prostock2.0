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

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { operations } = await req.json();
    const results: any[] = [];

    for (const op of operations) {
      const { type, collection, id, data } = op;
      const delegate = COLLECTION_MAP[collection];
      if (!delegate) continue;
      const model = (prisma as any)[delegate];

      if (type === 'set') {
        let createData = data;
        if (collection === 'settings') createData = { data };
        const record = await model.upsert({
          where: { id },
          create: { id, ...createData },
          update: createData,
        });
        results.push(serializeForClient(record));
      } else if (type === 'update') {
        let updateData = data;
        if (collection === 'settings') updateData = { data };
        const record = await model.update({
          where: { id },
          data: updateData,
        });
        results.push(serializeForClient(record));
      } else if (type === 'delete') {
        await model.delete({ where: { id } });
        results.push({ deleted: id });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
