import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        passwordHash: hashPassword(password),
        role: 'user',
      },
    });

    await setSessionCookie(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 });
  }
}
