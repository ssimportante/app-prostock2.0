'use client';
import React from 'react';
import { Package, Settings, Warehouse, ShoppingCart, LayoutDashboard, BarChart, History, ChefHat, Coffee, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAuth } from '../auth/AuthProvider';

interface NavSection {
  title?: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: string[];
    badge?: string;
  }[];
}

export function AppSidebarNav({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname();
  const { appUser } = useAuth();
  const role = appUser?.role || 'user';

  const sections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'user', 'stock-manager'] },
        { href: '/sales', label: 'POS Terminal', icon: ShoppingCart, roles: ['admin', 'manager', 'user'], badge: 'Live' },
        { href: '/kds', label: 'Kitchen KDS', icon: ChefHat, roles: ['admin', 'manager', 'user', 'stock-manager'] },
        { href: '/bar', label: 'Bar KDS', icon: Coffee, roles: ['admin', 'manager', 'user', 'stock-manager'] },
      ]
    },
    {
      title: 'Inventory & Catalog',
      items: [
        { href: '/items', label: 'Items & Products', icon: Package, roles: ['admin', 'manager', 'user'] },
        { href: '/stock', label: 'Stock Manager', icon: Warehouse, roles: ['admin', 'manager', 'stock-manager'] },
        { href: '/stock-activity', label: 'Stock Activity', icon: History, roles: ['admin'] },
      ]
    },
    {
      title: 'Analytics & Admin',
      items: [
        { href: '/reports', label: 'Analytics & Reports', icon: BarChart, roles: ['admin', 'manager'] },
      ]
    }
  ];

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section, idx) => {
          const visibleItems = section.items.filter(item => item.roles.includes(role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {isOpen && section.title && (
                <p className="px-3 text-[10px] font-bold tracking-wider text-[hsl(var(--sidebar-foreground))]/40 uppercase mb-2">
                  {section.title}
                </p>
              )}
              {visibleItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150',
                          isActive
                            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-xs'
                            : 'text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]',
                          !isOpen && 'justify-center px-2 py-2.5'
                        )}
                      >
                        {/* Active Accent Pill */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                        )}

                        <div className={cn(
                          'flex items-center justify-center p-1 rounded-lg transition-colors',
                          isActive ? 'bg-primary/20 text-primary' : 'text-[hsl(var(--sidebar-foreground))]/60 group-hover:text-[hsl(var(--sidebar-foreground))]'
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>

                        {isOpen && (
                          <div className="flex flex-1 items-center justify-between overflow-hidden">
                            <span className="truncate">{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    </TooltipTrigger>
                    {!isOpen && (
                      <TooltipContent side="right" className="font-semibold text-xs">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>

      {role && ['admin', 'manager'].includes(role) && (
        <div className="mt-auto p-3 border-t border-[hsl(var(--sidebar-border))]">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                  pathname.startsWith('/settings')
                    ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]'
                    : 'text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]',
                  !isOpen && 'justify-center px-2 py-2.5'
                )}
              >
                <div className="p-1 rounded-lg text-[hsl(var(--sidebar-foreground))]/60 group-hover:text-[hsl(var(--sidebar-foreground))]">
                  <Settings className="h-4 w-4" />
                </div>
                {isOpen && <span>Settings & System</span>}
              </Link>
            </TooltipTrigger>
            {!isOpen && <TooltipContent side="right">Settings & System</TooltipContent>}
          </Tooltip>
        </div>
      )}
    </TooltipProvider>
  );
}

