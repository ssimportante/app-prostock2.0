'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { ReportsSummary } from '@/lib/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { KpiCards } from './KpiCards';
import { SalesTrendChart } from './SalesTrendChart';
import { AlertsPanel } from './AlertsPanel';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function DashboardClient() {
  const { settings } = useSettings();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ summary: ReportsSummary }>('/api/reports/summary')
      .then((d) => setSummary(d.summary))
      .catch(() => setError('Could not load dashboard data. Try refreshing.'));
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-headline text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business performance and inventory health at a glance.
        </p>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!summary && !error && <DashboardSkeleton />}

      {summary && (
        <>
          <KpiCards kpis={summary.kpis} />
          <SalesTrendChart data={summary.salesByDay} currency={settings.currency} />
          <AlertsPanel lowStock={summary.lowStock} expiring={summary.expiring} currency={settings.currency} />
        </>
      )}
    </div>
  );
}
