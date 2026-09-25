'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Trash2, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSettings } from '@/contexts/SettingsProvider';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { formatMoney, round3 } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ActivityEntry } from '@/lib/types';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'receipt', label: 'Received' },
  { key: 'waste', label: 'Waste' },
  { key: 'pull-out', label: 'Pull-outs' },
] as const;

export function StockActivityClient() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  useEffect(() => {
    api<{ entries: ActivityEntry[] }>('/api/stock-activity')
      .then((d) => setEntries(d.entries))
      .catch(() => toast({ title: 'Could not load activity', variant: 'destructive' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    if (filter === 'all') return entries;
    if (filter === 'waste') return entries.filter((e) => e.kind === 'waste' && e.eventType === 'waste');
    if (filter === 'pull-out') return entries.filter((e) => e.kind === 'waste' && e.eventType === 'pull-out');
    return entries.filter((e) => e.kind === 'receipt');
  }, [entries, filter]);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-headline text-3xl font-semibold tracking-tight">Stock activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every stock receipt, waste event, and pull-out across the shop.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!entries && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {entries && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-warm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-20">Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">By</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const isReceipt = entry.kind === 'receipt';
                const isPullOut = entry.kind === 'waste' && entry.eventType === 'pull-out';
                const date = new Date(entry.date);
                return (
                  <TableRow key={`${entry.kind}-${entry.id}`}>
                    <TableCell>
                      {isReceipt ? (
                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                          <ArrowDownToLine className="h-3 w-3" /> In
                        </Badge>
                      ) : isPullOut ? (
                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                          <Undo2 className="h-3 w-3" /> Out
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
                          <Trash2 className="h-3 w-3" /> Waste
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{entry.itemName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isReceipt ? '+' : '−'}
                      {round3(entry.quantity)}{' '}
                      <span className="text-xs text-muted-foreground">{entry.unit}</span>
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                      {isReceipt
                        ? entry.batchDate
                          ? `${entry.batchDateType === 'roast' ? 'Roast' : 'Expiry'} ${entry.batchDate}`
                          : 'No batch date'
                        : entry.reason}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {isReceipt ? '—' : formatMoney(entry.cost, settings.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {entry.userName}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(date, 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    Nothing here yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-right text-xs text-muted-foreground">
        Times shown in shop local time
      </p>
    </div>
  );
}
