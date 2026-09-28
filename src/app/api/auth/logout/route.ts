import { NextResponse } from 'next/server';
import { sessionCookieName } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(sessionCookieName);
  return response;
}
