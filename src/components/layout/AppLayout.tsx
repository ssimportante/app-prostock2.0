'use client';

import React, { useState, useEffect } from 'react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AppSidebarNav } from './AppSidebarNav';
import Link from 'next/link';
import { Logo } from '../icons/Logo';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children, isLoading }: { children: React.ReactNode, isLoading?: boolean }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && isMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [pathname, isMobile, isMounted]);

  // If the component hasn't mounted yet, or if auth/data is loading, show the full-screen spinner.
  if (!isMounted || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading ProStock...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {!isMobile && <AppSidebar isOpen={isDesktopSidebarOpen} />}
      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-300',
          !isMobile && (isDesktopSidebarOpen ? 'ml-64' : 'ml-20')
        )}
      >
        <AppHeader
          onMenuClick={() => {
            if (isMobile) {
              setIsMobileSidebarOpen(true);
            } else {
              setIsDesktopSidebarOpen((prev) => !prev);
            }
          }}
        />
        <main className="flex-1">{children}</main>
      </div>
      {isMobile && (
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 flex flex-col w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-r">
            <SheetHeader className="sr-only">
              <SheetTitle>Main Menu</SheetTitle>
              <SheetDescription>Main application navigation menu.</SheetDescription>
            </SheetHeader>
            <div className="flex h-14 items-center border-b px-4 lg:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <Logo className="h-6 w-6 text-[hsl(var(--sidebar-primary))]" />
                <span className={'font-headline text-lg'}>ProStock</span>
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
                <AppSidebarNav isOpen={true} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
