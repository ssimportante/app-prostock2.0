import { Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <Coffee className={cn('h-5 w-5', iconClassName)} />
      </span>
      <span className="font-headline text-xl font-semibold tracking-tight">ProStock</span>
    </span>
  );
}
