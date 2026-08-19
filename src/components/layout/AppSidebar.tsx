'use client';

import React from 'react';
import { Logo } from '../icons/Logo';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AppSidebarNav } from './AppSidebarNav';

export default function AppSidebar({ isOpen }: { isOpen: boolean }) {
  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full hidden md:flex flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-all duration-300 z-40 shadow-xl',
        isOpen ? 'w-64' : 'w-20'
      )}
    >
      <div className="flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-4 lg:px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold group">
          <div className="p-2 rounded-xl bg-primary/20 text-primary transition-transform group-hover:scale-105">
            <Logo className="h-5 w-5" />
          </div>
          {isOpen && (
            <div className="flex flex-col">
              <span className="font-headline text-base font-bold tracking-tight text-white leading-tight">ProStock</span>
              <span className="text-[10px] text-white/50 font-medium tracking-wider uppercase">POS & Inventory</span>
            </div>
          )}
        </Link>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <AppSidebarNav isOpen={isOpen} />
      </div>
    </aside>
  );
}

