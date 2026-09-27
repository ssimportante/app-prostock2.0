import { cookies } from 'next/headers';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from './db';

const SESSION_COOKIE = 'prostock-session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'prostock-dev-secret-change-in-production';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  photoURL: string | null;
  role: string;
}

function signToken(payload: string): string {
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = token.substring(0, idx);
  const sig = token.substring(idx + 1);
  const expectedSig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  try {
    if (timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return payload;
    }
  } catch {
    // length mismatch
  }
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt + SESSION_SECRET).update(password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const testHash = createHmac('sha256', salt + SESSION_SECRET).update(password).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const payload = JSON.stringify({ uid: userId, ts: Date.now() });
  return signToken(payload);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  try {
    const { uid } = JSON.parse(payload);
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      photoURL: user.photoURL,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const token = await createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
