'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, PackagePlus, Trash2, Undo2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsProvider';
import { api, ApiError } from '@/lib/api-client';
import { formatMoney, round3 } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { StockOverviewRow } from '@/lib/types';

function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StockClient() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockOverviewRow[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);

  const [receiveItem, setReceiveItem] = useState('');
  const [receiveQty, setReceiveQty] = useState('1');
  const [batchDate, setBatchDate] = useState('');
  const [batchDateType, setBatchDateType] = useState<'expiry' | 'roast'>('expiry');

  const [wasteItem, setWasteItem] = useState('');
  const [wasteQty, setWasteQty] = useState('1');
  const [wasteReason, setWasteReason] = useState('');
  const [wasteType, setWasteType] = useState<'waste' | 'pull-out'>('waste');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const data = await api<{ rows: StockOverviewRow[] }>('/api/stock');
    setRows(data.rows);
  };

  useEffect(() => {
    void reload().catch(() => toast({ title: 'Could not load stock', variant: 'destructive' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
  const receiveRow = byId.get(receiveItem);
  const wasteRow = byId.get(wasteItem);
  const unitCost = wasteRow && wasteRow.stock > 0 ? wasteRow.value / wasteRow.stock : 0;
  const wasteCostPreview = Math.round(unitCost * (Number(wasteQty) || 0));

  const submitReceive = async () => {
    setBusy(true);
    try {
      await api('/api/stock/receive', {
        method: 'POST',
        body: {
          itemId: receiveItem,
          quantity: Number(receiveQty),
          batchDate: batchDate || undefined,
          batchDateType: batchDate ? batchDateType : undefined,
        },
      });
      toast({ title: 'Stock received', description: `${receiveQty} × ${receiveRow?.name}` });
      setReceiveOpen(false);
      setReceiveQty('1');
      setBatchDate('');
      await reload();
    } catch (e) {
      toast({
        title: 'Could not receive stock',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const submitWaste = async () => {
    setBusy(true);
    try {
      await api('/api/stock/waste', {
        method: 'POST',
        body: {
          itemId: wasteItem,
          quantity: Number(wasteQty),
          reason: wasteReason,
          eventType: wasteType,
        },
      });
      toast({
        title: wasteType === 'waste' ? 'Waste logged' : 'Pull-out logged',
        description: `${wasteQty} × ${wasteRow?.name}`,
      });
      setWasteOpen(false);
      setWasteQty('1');
      setWasteReason('');
      setWasteType('waste');
      await reload();
    } catch (e) {
      toast({
        title: 'Could not log event',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const totalValue = (rows ?? []).reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-headline text-3xl font-semibold tracking-tight">Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            On-hand quantities across tracked items.{' '}
            {rows && (
              <span className="font-medium text-foreground">
                Total value {formatMoney(totalValue, settings.currency)}
              </span>
            )}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button className="btn-press" onClick={() => setReceiveOpen(true)}>
            <PackagePlus className="h-4 w-4" /> Receive stock
          </Button>
          <Button className="btn-press" variant="outline" onClick={() => setWasteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Log waste
          </Button>
        </div>
      </div>

      {!rows && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {rows && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-warm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10" />
                <TableHead>Item</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const open = expanded === row.id;
                const out = row.stock <= 0;
                const low = row.stock > 0 && row.stock <= row.lowStockThreshold;
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(open ? null : row.id)}
                    >
                      <TableCell>
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {round3(row.stock)} <span className="text-xs text-muted-foreground">{row.unit}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatMoney(row.value, settings.currency)}
                      </TableCell>
                      <TableCell>
                        {out ? (
                          <Badge variant="destructive">Out of stock</Badge>
                        ) : low ? (
                          <Badge className="bg-amber-500/90">Low ({row.lowStockThreshold})</Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow key={`${row.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/30 py-3">
                          {row.batches.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No batches on hand.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {row.batches.map((batch) => (
                                <div
                                  key={batch.id}
                                  className="flex flex-wrap items-center gap-2 text-xs"
                                >
                                  <span className="w-24 font-medium tabular-nums">
                                    {round3(batch.quantity)} {row.unit}
                                  </span>
                                  <span className="text-muted-foreground">
                                    added {format(parseISO(batch.addedAt), 'MMM d, yyyy')}
                                  </span>
                                  {batch.expiryDate && (
                                    <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                                      expires {format(parseISO(batch.expiryDate), 'MMM d, yyyy')}
                                    </Badge>
                                  )}
                                  {batch.roastDate && (
                                    <Badge variant="outline" className="border-primary/30 text-primary">
                                      roasted {format(parseISO(batch.roastDate), 'MMM d, yyyy')}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DialogShell
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        title="Receive stock"
        description="Add a new batch to an item. It will be consumed after older batches."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Select value={receiveItem} onValueChange={setReceiveItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choose item" />
              </SelectTrigger>
              <SelectContent>
                {(rows ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receive-qty">
              Quantity {receiveRow && <span className="text-muted-foreground">({receiveRow.unit})</span>}
            </Label>
            <Input
              id="receive-qty"
              type="number"
              min="0"
              step={receiveRow?.unit === 'g/ml' ? '0.01' : '1'}
              value={receiveQty}
              onChange={(e) => setReceiveQty(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-date">Batch date (optional)</Label>
              <Input
                id="batch-date"
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date meaning</Label>
              <Select value={batchDateType} onValueChange={(v) => setBatchDateType(v as 'expiry' | 'roast')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expiry">Expiry date</SelectItem>
                  <SelectItem value="roast">Roast date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button className="btn-press" onClick={submitReceive} disabled={busy || !receiveItem || !(Number(receiveQty) > 0)}>
          Receive
        </Button>
      </DialogShell>

      <DialogShell
        open={wasteOpen}
        onOpenChange={setWasteOpen}
        title="Log waste or pull-out"
        description="Stock is deducted from the oldest batch. Pull-outs are tracked separately from waste."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Event type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWasteType('waste')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  wasteType === 'waste' ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border'
                )}
              >
                <Trash2 className="h-4 w-4" /> Waste
              </button>
              <button
                type="button"
                onClick={() => setWasteType('pull-out')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  wasteType === 'pull-out' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border'
                )}
              >
                <Undo2 className="h-4 w-4" /> Pull-out
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Select value={wasteItem} onValueChange={setWasteItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choose item" />
              </SelectTrigger>
              <SelectContent>
                {(rows ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waste-qty">
              Quantity {wasteRow && <span className="text-muted-foreground">({wasteRow.unit})</span>}
            </Label>
            <Input
              id="waste-qty"
              type="number"
              min="0"
              step={wasteRow?.unit === 'g/ml' ? '0.01' : '1'}
              value={wasteQty}
              onChange={(e) => setWasteQty(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waste-reason">Reason</Label>
            <Input
              id="waste-reason"
              placeholder="Expired batch, spilt, damaged…"
              value={wasteReason}
              onChange={(e) => setWasteReason(e.target.value)}
            />
          </div>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Estimated cost:{' '}
            <span className="font-semibold text-foreground">
              {formatMoney(wasteCostPreview, settings.currency)}
            </span>
          </p>
        </div>
        <Button
          className="btn-press"
          onClick={submitWaste}
          disabled={busy || !wasteItem || !(Number(wasteQty) > 0)}
        >
          Log {wasteType === 'waste' ? 'waste' : 'pull-out'}
        </Button>
      </DialogShell>
    </div>
  );
}
