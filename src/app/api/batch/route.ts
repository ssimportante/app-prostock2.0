import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, validateCsrfToken } from '@/lib/auth-server';
import { canWrite, canDelete } from '@/lib/authz';
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

  if (!(await validateCsrfToken(req))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  try {
    const { operations } = await req.json();
    const results: any[] = [];

    for (const op of operations) {
      const { type, collection, id, data } = op;
      const delegate = COLLECTION_MAP[collection];
      if (!delegate) continue;

      // Check authorization for each operation
      if (type === 'delete') {
        if (!canDelete(collection, sessionUser)) {
          return NextResponse.json({ error: `Forbidden: cannot delete from ${collection}` }, { status: 403 });
        }
      } else {
        if (!canWrite(collection, sessionUser)) {
          return NextResponse.json({ error: `Forbidden: cannot write to ${collection}` }, { status: 403 });
        }
      }

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
