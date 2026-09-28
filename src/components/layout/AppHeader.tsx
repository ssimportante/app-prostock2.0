
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth as useAppAuth } from '../auth/AuthProvider';
import { User, LogOut, PanelLeft, ShoppingCart, ChefHat, Coffee, LayoutDashboard, Clock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { appUser } = useAppAuth();
  const pathname = usePathname();
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
        ' • ' +
        now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const quickNav = [
    { href: '/sales', label: 'POS', icon: ShoppingCart },
    { href: '/kds', label: 'Kitchen', icon: ChefHat },
    { href: '/bar', label: 'Bar', icon: Coffee },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/80 bg-background/80 backdrop-blur-md px-4 sm:px-6 transition-all">
      <Button 
        variant="ghost" 
        size="icon" 
        className="shrink-0 h-9 w-9 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground active:scale-95 transition-transform" 
        onClick={onMenuClick}
        aria-label="Toggle Sidebar"
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

      {/* Quick Launch Station Tabs */}
      <div className="hidden md:flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50">
        {quickNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Real-time Clock */}
        {timeString && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border/40">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>{timeString}</span>
          </div>
        )}

        {/* User Account Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-1 pl-2 pr-3 h-10 rounded-full border border-border/60 hover:bg-muted/60 active:scale-95 transition-all"
            >
              <Avatar className="h-7 w-7 border border-primary/20">
                <AvatarImage src={appUser?.photoURL || ''} alt={appUser?.name || 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {appUser?.name ? appUser.name.slice(0, 2).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left text-xs">
                <span className="font-semibold text-foreground leading-none">{appUser?.name || 'Cashier'}</span>
                <span className="text-[10px] text-muted-foreground capitalize leading-tight mt-0.5 font-medium">{appUser?.role || 'Staff'}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-border/80 p-1.5">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">{appUser?.name || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">{appUser?.email || ''}</p>
                <div className="pt-1">
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
                    {appUser?.role || 'user'}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="cursor-pointer flex items-center gap-2 text-xs py-2">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/sales" className="cursor-pointer flex items-center gap-2 text-xs py-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                POS Terminal
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-xs py-2">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

