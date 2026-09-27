import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword, setSessionCookie } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    // Auto-create default users if they don't exist (mirrors original Firebase behavior)
    if (!user) {
      const defaultRoles: Record<string, string> = {
        'admin@beanespress.com': 'admin',
        'stockman@beanespress.com': 'stock-manager',
        'kitchen@beanespress.com': 'kitchen-user',
        'bar@beanespress.com': 'bar-user',
      };
      if (defaultRoles[email] && password === 'password') {
        user = await prisma.user.create({
          data: {
            email,
            name: email.split('@')[0],
            passwordHash: hashPassword(password),
            role: defaultRoles[email],
          },
        });
      } else {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      if (!verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

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
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
