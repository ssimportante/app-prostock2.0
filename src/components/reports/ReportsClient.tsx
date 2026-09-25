'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { ReportsSummary } from '@/lib/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { TopItemsChart } from './TopItemsChart';
import { CategoryPieChart } from './CategoryPieChart';
import { MovementChart } from './MovementChart';
import { WasteTable } from './WasteTable';
import { Card, CardContent } from '@/components/ui/card';
import { Banknote, Recycle, Percent, Undo2 } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { Skeleton } from '@/components/ui/skeleton';

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="shadow-warm">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-headline text-lg font-semibold leading-tight tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportsClient() {
  const { settings } = useSettings();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ summary: ReportsSummary }>('/api/reports/summary')
      .then((d) => setSummary(d.summary))
      .catch(() => setError('Could not load reports. Try refreshing.'));
  }, []);

  const f = (c: number) => formatMoney(c, settings.currency);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-headline text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep dive into sales, consumption, and inventory movement.
        </p>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {!summary && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Total revenue" value={f(summary.kpis.totalRevenue)} icon={Banknote} />
            <MiniStat label="Cost of goods" value={f(summary.kpis.totalCogs)} icon={Percent} />
            <MiniStat label="Waste" value={f(summary.kpis.wasteValue)} icon={Recycle} />
            <MiniStat label="Pull-outs" value={f(summary.kpis.pullOutValue)} icon={Undo2} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopItemsChart data={summary.topItems} currency={settings.currency} />
            <CategoryPieChart data={summary.categoryDist} currency={settings.currency} />
            <MovementChart movement={summary.movement} currency={settings.currency} />
            <WasteTable data={summary.wasteByItem} currency={settings.currency} />
          </div>
        </>
      )}
    </div>
  );
}
