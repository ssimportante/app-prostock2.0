'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, Bike, Loader2, Minus, Percent, Plus, Search, Utensils, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsProvider';
import { api, ApiError } from '@/lib/api-client';
import { formatMoney, round3 } from '@/lib/money';
import { computeSaleMath, type LineInput } from '@/lib/checkout-math';
import { cn } from '@/lib/utils';
import type { Category, Item, Sale, SaleType } from '@/lib/types';

interface CartLine {
  key: string;
  itemId: string;
  name: string;
  quantity: number;
  discount?: { type: 'percent' | 'fixed'; value: number };
}

interface SaleTypeOption {
  value: SaleType;
  label: string;
  icon: React.ElementType;
}

const SALE_TYPES: SaleTypeOption[] = [
  { value: 'dine-in', label: 'Dine-in', icon: Utensils },
  { value: 'take-away', label: 'Take-away', icon: Bike },
];

export function PosClient() {
  const { settings, taxes } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleType, setSaleType] = useState<SaleType>('dine-in');
  const [deliveryFee, setDeliveryFee] = useState('0.00');
  const [ticketDiscount, setTicketDiscount] = useState<{ type: 'percent' | 'fixed'; value: number } | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ items: Item[] }>('/api/items'),
      api<{ categories: Category[] }>('/api/categories'),
    ])
      .then(([itemsRes, cats]) => {
        setItems(itemsRes.items);
        setCategories(cats.categories);
      })
      .catch(() => toast({ title: 'Could not load the menu', variant: 'destructive' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sellable = useMemo(
    () => (items ?? []).filter((i) => i.isSellable && (i.saleType === null || i.saleType === saleType)),
    [items, saleType]
  );

  const stockOf = (item: Item) =>
    item.trackStock ? round3((item.stockBatches ?? []).reduce((s, b) => s + Number(b.quantity || 0), 0)) : null;

  const filteredTiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellable.filter((item) => {
      const inCategory = activeCategory === 'all' || item.categoryId === activeCategory;
      const matches = !q || item.name.toLowerCase().includes(q);
      return inCategory && matches;
    });
  }, [sellable, search, activeCategory]);

  const addToCart = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id && !l.discount);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key: `${item.id}_${Date.now()}`, itemId: item.id, name: item.name, quantity: 1 }];
    });
  };

  const setQuantity = (key: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    );

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const lineDiscount = (key: string, discount: { type: 'percent' | 'fixed'; value: number } | null) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, discount: discount ?? undefined } : l)));

  // Live preview using the exact same math as the server.
  const preview = useMemo(
    () =>
      computeSaleMath(
        cart.map((l): LineInput => ({ itemId: l.itemId, quantity: l.quantity, discount: l.discount })),
        items ?? [],
        taxes,
        ticketDiscount ?? undefined,
        Math.round((Number(deliveryFee) || 0) * 100)
      ),
    [cart, items, taxes, ticketDiscount, deliveryFee]
  );

  const checkout = async () => {
    setBusy(true);
    try {
      const res = await api<{ sale: Sale }>('/api/sales', {
        method: 'POST',
        body: {
          items: cart.map((l) => ({ itemId: l.itemId, quantity: l.quantity, discount: l.discount })),
          discount: ticketDiscount ?? undefined,
          deliveryFee: Math.round((Number(deliveryFee) || 0) * 100),
          saleType,
        },
      });
      setLastSale(res.sale);
      setCart([]);
      setTicketDiscount(null);
      setDeliveryFee('0.00');
      const itemsRes = await api<{ items: Item[] }>('/api/items');
      setItems(itemsRes.items);
    } catch (e) {
      toast({
        title: 'Checkout failed',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name;

  if (!items) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[1fr_380px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_400px]">
      {/* Tiles */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1 sm:max-w-60">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                activeCategory === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40'
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  activeCategory === c.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredTiles.map((item) => {
            const stock = stockOf(item);
            const out = stock !== null && stock <= 0;
            return (
              <button
                key={item.id}
                disabled={out}
                onClick={() => addToCart(item)}
                className={cn(
                  'btn-press flex h-24 flex-col items-start justify-between rounded-xl border p-3 text-left transition-all',
                  out ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:shadow-md'
                )}
                style={{
                  background: `${item.posColor}12`,
                  borderColor: `${item.posColor}45`,
                }}
              >
                <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</span>
                <span className="flex w-full items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: item.posColor }}>
                    {formatMoney(item.price, settings.currency)}
                  </span>
                  {stock !== null && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        out
                          ? 'bg-foreground/10 text-foreground/50'
                          : stock <= item.lowStockThreshold
                            ? 'bg-amber-500/15 text-amber-700'
                            : 'bg-foreground/5 text-muted-foreground'
                      )}
                    >
                      {out ? 'Out' : `${stock} left`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {filteredTiles.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Nothing matches — try another category or search.
            </p>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col rounded-xl border border-border bg-card shadow-warm">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <h2 className="font-headline text-lg font-semibold">Current order</h2>
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
              {SALE_TYPES.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSaleType(opt.value)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                      saleType === opt.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[42vh] min-h-32 overflow-y-auto px-3 py-2">
            {cart.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Tap menu items to start an order.
              </p>
            )}
            {cart.map((line) => {
              const item = items.find((i) => i.id === line.itemId);
              const lineGross = (item?.price ?? 0) * line.quantity;
              const lineAmount = preview.saleItems.find((s) => s.name === line.name)?.discount?.amount;
              void lineGross;
              return (
                <div key={line.key} className="flex items-center gap-2 border-b border-border/50 py-2 last:border-0">
                  <span
                    className="h-7 w-1.5 shrink-0 rounded-full"
                    style={{ background: item?.posColor ?? 'hsl(var(--primary))' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {formatMoney(item?.price ?? 0, settings.currency)} each
                      </span>
                      {lineAmount ? (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          −{formatMoney(lineAmount, settings.currency)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(line.key, -1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(line.key, 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMoney(
                        (item?.price ?? 0) * line.quantity,
                        settings.currency
                      )}
                    </span>
                    <div className="flex">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              'rounded p-0.5 text-muted-foreground hover:text-primary',
                              line.discount && 'text-primary'
                            )}
                            aria-label="Line discount"
                          >
                            <Percent className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-2" align="end">
                          <p className="pb-1 text-xs font-semibold text-muted-foreground">
                            Discount for {line.name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={line.discount?.type ?? 'percent'}
                              onValueChange={(v) => {
                                const value = line.discount?.value ?? 10;
                                lineDiscount(line.key, { type: v as 'percent' | 'fixed', value });
                              }}
                            >
                              <SelectTrigger className="h-8 w-16 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">%</SelectItem>
                                <SelectItem value="fixed">Amount</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 flex-1 text-xs"
                              type="number"
                              min="0"
                              value={line.discount?.value ?? 0}
                              onChange={(e) =>
                                lineDiscount(line.key, {
                                  type: line.discount?.type ?? 'percent',
                                  value: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 px-2 text-xs text-destructive"
                            onClick={() => lineDiscount(line.key, null)}
                          >
                            Remove discount
                          </Button>
                        </PopoverContent>
                      </Popover>
                      <button
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />
          <div className="space-y-2 px-4 py-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => setDiscountDialogOpen(true)}
              >
                <Percent className="h-3.5 w-3.5" />
                {ticketDiscount
                  ? `Ticket −${ticketDiscount.type === 'percent' ? `${ticketDiscount.value}%` : formatMoney(ticketDiscount.value, settings.currency)}`
                  : 'Ticket discount'}
              </Button>
              {saleType === 'take-away' && (
                <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border px-2">
                  <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 border-0 px-0 text-xs focus-visible:ring-0"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Delivery fee"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(preview.subtotal, settings.currency)}</span>
              </div>
              {(preview.lineDiscountTotal > 0 || preview.ticketDiscount > 0) && (
                <div className="flex justify-between text-destructive">
                  <span>Discounts</span>
                  <span className="tabular-nums">
                    −{formatMoney(preview.lineDiscountTotal + preview.ticketDiscount, settings.currency)}
                  </span>
                </div>
              )}
              {preview.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular-nums">{formatMoney(preview.tax, settings.currency)}</span>
                </div>
              )}
              {preview.deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery</span>
                  <span className="tabular-nums">{formatMoney(preview.deliveryFee, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-headline text-lg font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(preview.total, settings.currency)}</span>
              </div>
            </div>

            <Button
              className="btn-press h-11 w-full text-base font-semibold"
              disabled={busy || cart.length === 0}
              onClick={checkout}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Banknote className="h-5 w-5" />}
              Charge {formatMoney(preview.total, settings.currency)}
            </Button>
          </div>
        </div>
      </div>

      {/* Ticket discount dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-headline">Ticket discount</DialogTitle>
            <DialogDescription>Applies to the whole order after line discounts.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? '10' : '50.00'}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setTicketDiscount(null);
                setDiscountDialogOpen(false);
              }}
            >
              Remove discount
            </Button>
            <Button
              onClick={() => {
                const value = Number(discountValue) || 0;
                setTicketDiscount(
                  value > 0
                    ? {
                        type: discountType,
                        value: discountType === 'fixed' ? Math.round(value * 100) : value,
                      }
                    : null
                );
                setDiscountDialogOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={!!lastSale} onOpenChange={(open) => !open && setLastSale(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-headline text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Banknote className="h-5 w-5" />
              </span>
              Order sent to kitchen
            </DialogTitle>
            <DialogDescription>
              Ticket <span className="font-semibold text-foreground">#{lastSale?.ticketNumber}</span> ·{' '}
              {formatMoney(lastSale?.total ?? 0, settings.currency)} · {lastSale?.items.length} lines
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            {lastSale?.items.map((li, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span>
                  {li.quantity}× {li.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(li.price * li.quantity - (li.discount?.amount ?? 0), settings.currency)}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="btn-press w-full" onClick={() => setLastSale(null)}>
              New order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
