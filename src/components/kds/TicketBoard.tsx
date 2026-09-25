'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Circle, Clock, Martini, Play, X } from 'lucide-react';
import { formatDistanceToNow, isSameDay, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Sale, SaleItem } from '@/lib/types';

const POLL_MS = 8000;

function TicketCard({
  sale,
  lines,
  onAdvance,
  onCancel,
}: {
  sale: Sale;
  lines: SaleItem[];
  onAdvance: (sale: Sale) => void;
  onCancel: (sale: Sale) => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-warm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-headline text-xl font-semibold leading-none">#{sale.ticketNumber}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(parseISO(sale.date), { addSuffix: true })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={cn(
              sale.saleType === 'take-away'
                ? 'border-primary/40 text-primary'
                : 'border-border text-muted-foreground'
            )}
          >
            {sale.saleType === 'take-away' ? (
              <>
                <Bike className="mr-1 h-3 w-3" /> Take-away
              </>
            ) : (
              'Dine-in'
            )}
          </Badge>
          {sale.deliveryFee > 0 && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Delivery
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="flex items-baseline gap-2 text-sm">
            <span className="font-bold text-primary">{line.quantity}×</span>
            <span className="font-medium">{line.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        {sale.status === 'pending' ? (
          <>
            <Button size="sm" className="btn-press flex-1" onClick={() => onAdvance(sale)}>
              <Play className="h-3.5 w-3.5" /> Start preparing
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => onCancel(sale)}
              aria-label="Cancel ticket"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" className="btn-press flex-1" onClick={() => onAdvance(sale)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark completed
          </Button>
        )}
      </div>
    </div>
  );
}

export function TicketBoard({ variant }: { variant: 'kitchen' | 'bar' }) {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[] | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ sales: Sale[] }>('/api/sales');
      const today = new Date();
      setSales(data.sales.filter((s) => isSameDay(parseISO(s.date), today)));
    } catch {
      // transient poll failure; keep last snapshot
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const updateStatus = async (sale: Sale, status: 'preparing' | 'completed' | 'cancelled') => {
    // optimistic update
    setSales((prev) =>
      prev ? prev.map((s) => (s.id === sale.id ? { ...s, status } : s)) : prev
    );
    try {
      await api(`/api/sales/${sale.id}`, { method: 'PATCH', body: { status } });
    } catch (e) {
      toast({
        title: 'Could not update ticket',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
      void reload();
    }
  };

  const relevantLines = (sale: Sale): SaleItem[] =>
    variant === 'bar'
      ? sale.items.filter((l) => l.itemType === 'beverage')
      : sale.items;

  const tickets = useMemo(() => {
    if (!sales) return null;
    const visible = sales.filter((s) => {
      if (s.status === 'cancelled') return false;
      if (variant === 'kitchen') return true;
      return relevantLines(s).length > 0;
    });
    return {
      pending: visible
        .filter((s) => s.status === 'pending')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      preparing: visible
        .filter((s) => s.status === 'preparing')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      completed: visible
        .filter((s) => s.status === 'completed')
        .sort((a, b) => new Date(b.completedAt ?? b.date).getTime() - new Date(a.completedAt ?? a.date).getTime()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, variant]);

  const isBar = variant === 'bar';
  const Icon = isBar ? Martini : ChefHat;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-headline text-3xl font-semibold tracking-tight">
            <Icon className="h-7 w-7 text-primary" />
            {isBar ? 'Bar Station' : 'Kitchen Display'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBar
              ? 'Drink tickets from the register, newest last. Updates live.'
              : 'Live ticket queue from the register. Updates live.'}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto gap-1.5 border-primary/30 py-1.5 text-primary">
          <Circle className="h-2 w-2 fill-primary" /> Live
        </Badge>
      </div>

      {!tickets && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {tickets && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <section>
              <h2 className="flex items-center gap-2 pb-2 text-sm font-semibold text-muted-foreground">
                <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
                Pending {tickets.pending.length > 0 && `(${tickets.pending.length})`}
              </h2>
              <div className="space-y-3">
                {tickets.pending.map((sale) => (
                  <TicketCard
                    key={sale.id}
                    sale={sale}
                    lines={relevantLines(sale)}
                    onAdvance={(s) => updateStatus(s, 'preparing')}
                    onCancel={(s) => updateStatus(s, 'cancelled')}
                  />
                ))}
                {tickets.pending.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    No pending tickets.
                  </p>
                )}
              </div>
            </section>
            <section>
              <h2 className="flex items-center gap-2 pb-2 text-sm font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Preparing {tickets.preparing.length > 0 && `(${tickets.preparing.length})`}
              </h2>
              <div className="space-y-3">
                {tickets.preparing.map((sale) => (
                  <TicketCard
                    key={sale.id}
                    sale={sale}
                    lines={relevantLines(sale)}
                    onAdvance={(s) => updateStatus(s, 'completed')}
                    onCancel={() => undefined}
                  />
                ))}
                {tickets.preparing.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Nothing on the bar.
                  </p>
                )}
              </div>
            </section>
          </div>

          {tickets.completed.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 pb-2 text-sm font-semibold text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Completed today ({tickets.completed.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {tickets.completed.slice(0, 20).map((sale) => (
                  <span
                    key={sale.id}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    #{sale.ticketNumber} · {sale.items.reduce((s, l) => s + l.quantity, 0)} items
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
