import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, validateCsrfToken } from '@/lib/auth-server';

export async function PUT(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!(await validateCsrfToken(req))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { name, photoURL } = await req.json();
    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name;
    if (photoURL !== undefined) data.photoURL = photoURL;

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data,
    });

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
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
