'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useMemo,
} from 'react';
import { AppUser } from '@/types';
import { usePathname, useRouter } from 'next/navigation';
import AppLayout from '../layout/AppLayout';
import { SettingsProvider } from '@/contexts/SettingsProvider';
import { refreshAllData } from '@/lib/api-hooks';

interface AuthContextType {
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  appUser: null,
  loading: true,
});

const ALLOWED_ROUTES_BY_ROLE: Record<string, string[] | null> = {
    admin: null, // Can access all routes
    manager: ['/dashboard', '/items', '/stock', '/sales', '/reports', '/settings', '/kds', '/bar'],
    'stock-manager': ['/stock', '/stock-activity', '/kds', '/bar'],
    user: ['/dashboard', '/items', '/sales', '/kds', '/bar'],
};

const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
    admin: '/dashboard',
    manager: '/dashboard',
    'stock-manager': '/stock',
    user: '/dashboard',
};

function AuthContent({ children }: { children: ReactNode }) {
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        let cancelled = false;
        async function fetchUser() {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) {
                    if (!cancelled) { setAppUser(null); setLoading(false); }
                    return;
                }
                const data = await res.json();
                if (!cancelled) {
                    setAppUser(data.uid ? data : null);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) { setAppUser(null); setLoading(false); }
            }
        }
        fetchUser();
        return () => { cancelled = true; };
    }, []);

    const isPublicRoute = pathname === '/login';
    const isAuthenticated = !!appUser;

    useEffect(() => {
        if (loading) return;

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
            if (allowedRoutes && !allowedRoutes.some(route => pathname.startsWith(route))) {
                const defaultRoute = DEFAULT_ROUTE_BY_ROLE[appUser.role] || '/dashboard';
                router.push(defaultRoute);
                return;
            }
        }
    }, [loading, isAuthenticated, isPublicRoute, router, appUser, pathname]);

    const contextValue = useMemo(() => ({
        appUser: appUser || null,
        loading,
    }), [appUser, loading]);

    // On public routes, render directly without the AppLayout shell
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
                <AppLayout isLoading={loading || !isAuthenticated}>
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
