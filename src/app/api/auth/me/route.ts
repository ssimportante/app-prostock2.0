import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, sessionCookieName } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(sessionCookieName)?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    // Verify user still exists
    const user = await prisma.user.findFirst({ where: { uid: payload.uid } });
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      photoURL: user.photoURL,
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
