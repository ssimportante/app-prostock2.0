import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { destroySession, SESSION_COOKIE } from '@/server/auth';

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
