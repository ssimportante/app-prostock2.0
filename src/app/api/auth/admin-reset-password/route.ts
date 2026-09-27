import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, hashPassword, validateCsrfToken } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (sessionUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!(await validateCsrfToken(req))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'User ID and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent resetting the admin@beanespress.com account via this endpoint
    if (targetUser.email === 'admin@beanespress.com') {
      return NextResponse.json(
        { error: 'This account password can only be changed via the Change Password flow' },
        { status: 403 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin reset password error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 500 });
  }
}
