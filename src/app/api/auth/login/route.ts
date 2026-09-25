import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/server/db';
import { createSession, SESSION_COOKIE, verifyPassword } from '@/server/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  void expiresAt;
  return res;
}
