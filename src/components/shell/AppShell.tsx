'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  BarChart3, Boxes, ChefHat, Coffee, History, LayoutDashboard, LogOut,
  Martini, Menu, Package, ScanBarcode, Settings as SettingsIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from './Logo';
import { useSession } from '@/components/providers/SessionProvider';
import { ROLE_LABEL } from '@/lib/rbac';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import type { Role } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'user'] },
      { href: '/sales', label: 'POS Register', icon: ScanBarcode, roles: ['admin', 'manager', 'user'] },
      { href: '/kds', label: 'Kitchen Display', icon: ChefHat, roles: ['admin', 'manager', 'stock-manager', 'user'] },
      { href: '/bar', label: 'Bar Station', icon: Martini, roles: ['admin', 'manager', 'stock-manager', 'user'] },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { href: '/items', label: 'Items', icon: Package, roles: ['admin', 'manager'] },
      { href: '/stock', label: 'Stock', icon: Boxes, roles: ['admin', 'manager', 'stock-manager'] },
      { href: '/stock-activity', label: 'Stock Activity', icon: History, roles: ['admin', 'stock-manager'] },
    ],
  },
  {
    section: 'Management',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
      { href: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin', 'manager'] },
    ],
  },
];

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <>
      {NAV.map((group) => {
        const items = group.items.filter((item) => item.roles.includes(user.role));
        if (!items.length) return null;
        return (
          <div key={group.section} className="px-3 pb-2">
            <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.section}
            </p>
            <nav className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        );
      })}
    </>
  );
}

function UserCard() {
  const { user } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
    }
  };

  return (
    <div className="m-3 flex items-center gap-3 rounded-xl bg-sidebar-accent/70 p-3">
      <Avatar className="h-9 w-9 border border-sidebar-primary/30">
        <AvatarFallback className="bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
        <p className="truncate text-xs text-sidebar-foreground/50">{ROLE_LABEL[user.role]}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        disabled={busy}
        aria-label="Log out"
        className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-primary"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex h-16 items-center border-b border-sidebar-border/60 px-5">
      <Logo />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && isMobile) setMobileOpen(false);
  }, [pathname, isMobile, mounted]);

  const currentLabel =
    NAV.flatMap((g) => g.items).find(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    )?.label ?? '';

  return (
    <div className="flex min-h-screen w-full bg-background">
      {!isMobile && (
        <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
          <BrandHeader />
          <div className="flex-1 overflow-y-auto pb-2">
            <NavLinks />
          </div>
          <UserCard />
        </aside>
      )}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <BrandHeader />
              <div className="flex-1 overflow-y-auto pb-2">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </div>
              <UserCard />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-8">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h2 className="font-headline text-lg font-semibold tracking-tight">{currentLabel}</h2>
          <div className="ml-auto flex items-center gap-2">
            {!isMobile && (
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                {format(new Date(), 'EEE, MMM d')}
              </span>
            )}
            {!isMobile && (
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Coffee className="h-3.5 w-3.5" />
                Brew day in progress
              </span>
            )}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
