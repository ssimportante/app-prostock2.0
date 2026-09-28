import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, sessionCookieName, sessionMaxAge } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createSessionToken({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      photoURL: user.photoURL,
    });

    const response = NextResponse.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      photoURL: user.photoURL,
    });
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: sessionMaxAge,
      path: '/',
    });
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
