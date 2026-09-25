import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, persist } from './db';
import { verifyPassword } from './password';
import { DEFAULT_ROUTE } from '@/lib/rbac';
import type { AppUser, Role } from '@/lib/types';

export const SESSION_COOKIE = 'ps_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function createSession(userId: string): { token: string; expiresAt: string } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > new Date());
  db.sessions.push({ token, userId, expiresAt });
  persist();
  return { token, expiresAt };
}

export function destroySession(token: string) {
  const db = getDb();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  persist();
}

export async function getSessionUser(): Promise<AppUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** For server components: redirects unauthenticated users to /login and unauthorized roles to their home. */
export async function requirePageUser(roles?: Role[]): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (roles && !roles.includes(user.role)) redirect(DEFAULT_ROUTE[user.role]);
  return user;
}

export type ApiGate = { user: AppUser } | { error: string; status: number };

/** For route handlers: returns the user or an error payload to respond with. */
export async function apiGuard(roles?: Role[]): Promise<ApiGate> {
  const user = await getSessionUser();
  if (!user) return { error: 'Not authenticated', status: 401 };
  if (roles && !roles.includes(user.role)) {
    return { error: 'You do not have permission to do that', status: 403 };
  }
  return { user };
}

export function isGateError(gate: ApiGate): gate is { error: string; status: number } {
  return 'error' in gate;
}

export { verifyPassword };
