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
import { doc, getDoc, writeBatch } from 'firebase/firestore';
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
    const { user: authUser, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();

    const userProfileRef = useMemoFirebase(() => {
        return authUser ? doc(firestore, 'users', authUser.uid) : null;
    }, [firestore, authUser]);

    const { data: appUser, isLoading: isAppUserLoading } = useDoc<AppUser>(userProfileRef);

    // Profile creation logic
    useEffect(() => {
        if (isUserLoading || !authUser || appUser) return;

        const ensureUserDocs = async () => {
            const userDocRef = doc(firestore, 'users', authUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                try {
                    const batch = writeBatch(firestore);
                    const newUser: AppUser = {
                        uid: authUser.uid,
                        email: authUser.email,
                        name: authUser.displayName || authUser.email?.split('@')[0] || 'New User',
                        photoURL: authUser.photoURL,
                        role: 'user',
                    };

                    if (authUser.email === 'admin@beanespress.com') {
                        newUser.role = 'admin';
                        const adminRoleRef = doc(firestore, 'roles_admin', authUser.uid);
                        // Marker doc for rules identification
                        batch.set(adminRoleRef, {});
                    } else if (authUser.email === 'stockman@beanespress.com' || authUser.email === 'poc@beanespress.com') {
                        newUser.role = 'stock-manager';
                    }

                    batch.set(userDocRef, newUser);
                    await batch.commit();
                } catch (error) {
                    console.error("Error creating user profile:", error);
                }
            } else if (authUser.email === 'admin@beanespress.com') {
                // Ensure marker doc exists even if profile exists
                const adminRoleRef = doc(firestore, 'roles_admin', authUser.uid);
                const adminSnap = await getDoc(adminRoleRef);
                if (!adminSnap.exists()) {
                    try {
                        const batch = writeBatch(firestore);
                        batch.set(adminRoleRef, {});
                        await batch.commit();
                    } catch (e) {
                        console.error("Error establishing admin role marker:", e);
                    }
                }
            }
        };

        ensureUserDocs();
    }, [authUser, appUser, isUserLoading, firestore]);

    const isPublicRoute = pathname === '/login';
    const isAuthenticated = !!authUser && !!appUser;
    
    // The app is "initializing" if auth state hasn't been determined yet
    // or if we have a user but are still fetching their app-specific profile.
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