import { NextResponse, type NextRequest } from 'next/server';
import { getDb, newId, persist } from '@/server/db';
import { apiGuard, isGateError } from '@/server/auth';
import { hashPassword } from '@/server/password';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['admin', 'manager', 'stock-manager', 'user'];

export async function GET() {
  const gate = await apiGuard(['admin']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const users = getDb().users.map(({ passwordHash: _p, ...u }) => u);
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const gate = await apiGuard(['admin']);
  if (isGateError(gate)) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  const role = ROLES.includes(body.role) ? (body.role as Role) : 'user';
  if (!email || !name || password.length < 6) {
    return NextResponse.json(
      { error: 'Name, email and a password of at least 6 characters are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }
  const user = { id: newId('user'), email, name, role, passwordHash: hashPassword(password) };
  db.users.push(user);
  persist();
  const { passwordHash: _p, ...safe } = user;
  return NextResponse.json({ user: safe });
}
