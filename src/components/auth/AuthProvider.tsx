'use client';

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
  useMemo,
} from 'react';
import type { User } from 'firebase/auth';
import { AppUser } from '@/types';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import AppLayout from '../layout/AppLayout';
import { SettingsProvider } from '@/contexts/SettingsProvider';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
});

const ALLOWED_ROUTES_BY_ROLE: Record<string, string[] | null> = {
    admin: null,
    'stock-manager': ['/stock', '/settings'],
    'kitchen-user': ['/kds', '/settings'],
    'bar-user': ['/bar', '/settings'],
};

const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
    admin: '/dashboard',
    'stock-manager': '/stock',
    'kitchen-user': '/kds',
    'bar-user': '/bar',
};

function AuthContent({ children }: { children: ReactNode }) {
    const { user: authUser, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();

    const userProfileRef = useMemoFirebase(() => {
        return authUser ? { type: 'document', path: `users/${authUser.uid}`, id: authUser.uid, _path: { segments: ['users', authUser.uid] } } : null;
    }, [firestore, authUser]);

    const { data: appUser, isLoading: isAppUserLoading } = useDoc<AppUser>(userProfileRef);

    const isPublicRoute = pathname === '/login';
    const isAuthenticated = !!authUser && !!appUser;
    
    const isInitializing = isUserLoading || (!!authUser && isAppUserLoading);

    useEffect(() => {
        if (isInitializing) return;

        if (!isAuthenticated && !isPublicRoute) {
            router.push('/login');
            return;
        }

        if (isAuthenticated) {
            if (isPublicRoute) {
                const defaultRoute = DEFAULT_ROUTE_BY_ROLE[appUser.role] || '/dashboard';
                router.push(defaultRoute);
                return;
            }

            const allowedRoutes = ALLOWED_ROUTES_BY_ROLE[appUser.role];
            if (allowedRoutes === undefined) {
                // Unknown/legacy role (e.g. 'manager', 'user') — redirect to login
                router.push('/login');
                return;
            }
            if (allowedRoutes && !allowedRoutes.some(route => pathname.startsWith(route))) {
                const defaultRoute = DEFAULT_ROUTE_BY_ROLE[appUser.role] || '/dashboard';
                router.push(defaultRoute);
                return;
            }
        }
    }, [isInitializing, isAuthenticated, isPublicRoute, router, appUser, pathname]);
    
    const contextValue = useMemo(() => ({
        user: authUser,
        appUser: appUser || null,
        loading: isInitializing,
    }), [authUser, appUser, isInitializing]);

    if (isPublicRoute) {
        return (
            <AuthContext.Provider value={contextValue}>
                <SettingsProvider>
                    {children}
                </SettingsProvider>
            </AuthContext.Provider>
        );
    }

    return (
        <AuthContext.Provider value={contextValue}>
            <SettingsProvider>
                <AppLayout isLoading={isInitializing || !isAuthenticated}>
                    {children}
                </AppLayout>
            </SettingsProvider>
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
    return <AuthContent>{children}</AuthContent>;
}

export const useAuth = () => useContext(AuthContext);
