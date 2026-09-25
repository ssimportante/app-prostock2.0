'use client';

import { AlertTriangle, Banknote, CalendarClock, ChefHat, Package, Percent, Recycle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/money';
import type { SummaryKpis } from '@/lib/types';
import { cn } from '@/lib/utils';

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: 'default' | 'warning' | 'positive';
}) {
  return (
    <Card className="shadow-warm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg',
              tone === 'warning' && 'bg-amber-500/10 text-amber-600',
              tone === 'positive' && 'bg-primary/10 text-primary',
              tone === 'default' && 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-1.5 font-headline text-xl font-semibold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function KpiCards({ kpis }: { kpis: SummaryKpis }) {
  const f = (c: number) => formatMoney(c);
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="Total revenue"
        value={f(kpis.totalRevenue)}
        sub={`${kpis.ordersCount} orders`}
        icon={Banknote}
        tone="positive"
      />
      <Stat
        label="Food cost"
        value={`${kpis.foodCostPercentage.toFixed(1)}%`}
        sub={`${f(kpis.totalCogs)} COGS`}
        icon={Percent}
      />
      <Stat
        label="Stock value"
        value={f(kpis.totalStockValue)}
        sub={`Ing ${f(kpis.ingredientStockValue)} · Pkg ${f(kpis.packagingStockValue)}`}
        icon={Package}
      />
      <Stat label="Waste" value={f(kpis.wasteValue)} icon={Recycle} tone="warning" />
      <Stat
        label="Low / expiring"
        value={`${kpis.lowStockCount} / ${kpis.expiringCount}`}
        sub="items needing attention"
        icon={AlertTriangle}
        tone={kpis.lowStockCount + kpis.expiringCount > 0 ? 'warning' : 'default'}
      />
      <Stat
        label="Open tickets"
        value={String(kpis.pendingCount)}
        sub="pending in kitchen"
        icon={ChefHat}
      />
    </div>
  );
}
