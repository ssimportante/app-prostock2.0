'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AppUser } from '@/lib/types';

const SessionContext = createContext<{ user: AppUser } | null>(null);

export function SessionProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  return <SessionContext.Provider value={{ user }}>{children}</SessionContext.Provider>;
}

export function useSession(): { user: AppUser } {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
