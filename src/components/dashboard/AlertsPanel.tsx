'use client';

import { CalendarClock, PackageX, TriangleAlert } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ExpiringEntry, LowStockEntry } from '@/lib/types';

export function AlertsPanel({
  lowStock,
  expiring,
  currency,
}: {
  lowStock: LowStockEntry[];
  expiring: ExpiringEntry[];
  currency: string;
}) {
  void currency;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-headline text-lg font-semibold">
            <TriangleAlert className="h-[18px] w-[18px] text-amber-600" />
            Low stock
          </CardTitle>
          <CardDescription>Items at or below their threshold — reorder soon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lowStock.length === 0 && (
            <p className="text-sm text-muted-foreground">All stocked items are healthy.</p>
          )}
          {lowStock.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
            >
              <p className="text-sm font-medium">{entry.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {entry.stock} / {entry.threshold} {entry.unit}
                </span>
                <Badge variant="destructive" className={cn(entry.stock === 0 && 'bg-foreground/80')}>
                  {entry.stock === 0 ? 'Out' : 'Low'}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-headline text-lg font-semibold">
            <CalendarClock className="h-[18px] w-[18px] text-primary" />
            Expiring within 3 months
          </CardTitle>
          <CardDescription>Batches approaching their effective expiry</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {expiring.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing expiring in the next 3 months.</p>
          )}
          {expiring.map((entry, i) => (
            <div
              key={`${entry.itemName}-${i}`}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
            >
              <p className="text-sm font-medium">{entry.itemName}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {entry.quantity} {entry.unit}
                </span>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {format(parseISO(entry.effectiveExpiry), 'MMM d')}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
