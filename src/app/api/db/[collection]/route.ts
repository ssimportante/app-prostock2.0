import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, validateCsrfToken } from '@/lib/auth-server';
import { canWrite, canDelete } from '@/lib/authz';
import { serializeForClient } from '@/lib/serialize';
import { randomUUID } from 'crypto';

// Map Firestore collection names to Prisma model delegates
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
  staff: 'staff',
};

function getModel(collection: string) {
  const delegate = COLLECTION_MAP[collection];
  if (!delegate) return null;
  return (prisma as any)[delegate];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;
  const model = getModel(collection);
  if (!model) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  // Require authentication for all reads
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const whereParam = url.searchParams.get('where');
  const orderByParam = url.searchParams.get('orderBy');
  const orderDir = url.searchParams.get('orderDir') || 'asc';
  const limitParam = url.searchParams.get('limit');

  try {
    let where: any = {};

    // Parse where constraints
    if (whereParam) {
      const constraints = JSON.parse(whereParam);
      for (const c of constraints) {
        const { field, op, value } = c;
        if (field === '__id__' || field === 'documentId') {
          if (op === 'in') {
            where.id = { in: value };
          } else if (op === '==') {
            where.id = value;
          }
        } else {
          applyWhere(where, field, op, value);
        }
      }
    }

    let orderBy: any = undefined;
    if (orderByParam) {
      orderBy = { [orderByParam]: orderDir };
    }

    const take = limitParam ? parseInt(limitParam, 10) : undefined;

    const records = await model.findMany({ where, orderBy, take });
    if (collection === 'users') {
      records.forEach((r: any) => { delete r.passwordHash; r.uid = r.id; });
    }
    if (collection === 'settings') {
      records.forEach((r: any) => { const d = r.data; delete r.data; Object.assign(r, d); });
    }
    const serialized = serializeForClient(records);
    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error(`GET /api/db/${collection} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function applyWhere(where: any, field: string, op: string, value: any) {
  switch (op) {
    case '==':
      where[field] = value;
      break;
    case '!=':
      where[field] = { not: value };
      break;
    case 'in':
      where[field] = { in: value };
      break;
    case 'not-in':
      where[field] = { notIn: value };
      break;
    case '>':
      where[field] = { gt: value };
      break;
    case '>=':
      where[field] = { gte: value };
      break;
    case '<':
      where[field] = { lt: value };
      break;
    case '<=':
      where[field] = { lte: value };
      break;
    case 'array-contains':
      where[field] = { has: value };
      break;
    case 'array-contains-any':
      where[field] = { hasSome: value };
      break;
    default:
      where[field] = value;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;
  const model = getModel(collection);
  if (!model) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canWrite(collection, sessionUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!(await validateCsrfToken(req))) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = randomUUID();
    let data: any = body;
    if (collection === 'settings') {
      data = { data: body };
    }
    data = { id, ...data };
    const record = await model.create({ data });
    return NextResponse.json({ data: serializeForClient(record) });
  } catch (error: any) {
    console.error(`POST /api/db/${collection} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
