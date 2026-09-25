import { NextResponse, type NextRequest } from 'next/server';
import { getDb, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['admin', 'manager', 'stock-manager', 'user'];

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const db = getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (typeof body.name === 'string' && body.name.trim()) user.name = body.name.trim();
  if (ROLES.includes(body.role)) {
    if (user.id === gate.user.id && body.role !== 'admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 400 });
    }
    user.role = body.role as Role;
  }
  persist();
  const { passwordHash: _p, ...safe } = user;
  return NextResponse.json({ user: safe });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await apiGuard(['admin']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  if (id === gate.user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }
  const db = getDb();
  db.users = db.users.filter((u) => u.id !== id);
  db.sessions = db.sessions.filter((s) => s.userId !== id);
  persist();
  return NextResponse.json({ ok: true });
}
