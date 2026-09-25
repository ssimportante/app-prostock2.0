'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api-client';
import { fromCents, toCents } from '@/lib/money';
import type { Category, Item, ItemComponent, Station, Subcategory, Tax } from '@/lib/types';

interface ReferenceData {
  categories: Category[];
  subcategories: Subcategory[];
  stations: Station[];
  taxes: Tax[];
  allItems: Item[];
}

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  stationId: string;
  sku: string;
  barcode: string;
  isSellable: boolean;
  saleType: string; // 'both' | 'dine-in' | 'take-away'
  itemType: string; // '' | 'food' | 'beverage' | 'packaging'
  soldBy: 'each' | 'volume';
  price: string;
  cost: string;
  inventoryType: 'simple' | 'composite';
  trackStock: boolean;
  lowStockThreshold: string;
  yield: string;
  components: ItemComponent[];
  taxIds: string[];
  posColor: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  categoryId: '',
  subcategoryId: '',
  stationId: '',
  sku: '',
  barcode: '',
  isSellable: false,
  saleType: 'both',
  itemType: '',
  soldBy: 'each',
  price: '0.00',
  cost: '0.00',
  inventoryType: 'simple',
  trackStock: true,
  lowStockThreshold: '0',
  yield: '1',
  components: [],
  taxIds: [],
  posColor: '#B4552D',
};

function formFromItem(item: Item | null): FormState {
  if (!item) return { ...emptyForm };
  const rate = (cents: number) => (item.soldBy === 'volume' ? fromCents(cents * 100) : fromCents(cents));
  return {
    name: item.name,
    description: item.description ?? '',
    categoryId: item.categoryId,
    subcategoryId: item.subcategoryId ?? '',
    stationId: item.stationId ?? '',
    sku: item.sku,
    barcode: item.barcode ?? '',
    isSellable: item.isSellable,
    saleType: item.saleType ?? 'both',
    itemType: item.itemType ?? '',
    soldBy: item.soldBy,
    price: rate(item.price),
    cost: rate(item.cost),
    inventoryType: item.inventoryType,
    trackStock: item.trackStock,
    lowStockThreshold: String(item.lowStockThreshold ?? 0),
    yield: String(item.yield ?? 1),
    components: item.components.map((c) => ({ ...c })),
    taxIds: [...(item.taxIds ?? [])],
    posColor: item.posColor,
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0">
      {children}
    </p>
  );
}

export function ItemFormSheet({
  open,
  onOpenChange,
  item,
  reference,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  reference: ReferenceData;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(formFromItem(item));
  }, [open, item]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const subcategoryOptions = useMemo(
    () => reference.subcategories.filter((s) => s.categoryId === form.categoryId),
    [reference.subcategories, form.categoryId]
  );

  const componentCandidates = reference.allItems;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.categoryId) {
      toast({ title: 'Name and category are required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || null,
        stationId: form.stationId || null,
        sku: form.sku,
        barcode: form.barcode,
        isSellable: form.isSellable,
        saleType: form.saleType === 'both' ? null : form.saleType,
        itemType: form.itemType || null,
        soldBy: form.soldBy,
        // Volume items: inputs are per 100 g/ml; store the rate per unit.
        price: form.soldBy === 'volume' ? toCents(form.price) / 100 : toCents(form.price),
        cost: form.soldBy === 'volume' ? toCents(form.cost) / 100 : toCents(form.cost),
        inventoryType: form.inventoryType,
        trackStock: form.inventoryType === 'simple' ? form.trackStock : false,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
        yield: Number(form.yield) || 1,
        components: form.components,
        taxIds: form.taxIds,
        posColor: form.posColor,
      };
      if (item) {
        await api(`/api/items/${item.id}`, { method: 'PATCH', body });
        toast({ title: 'Item updated', description: form.name });
      } else {
        await api('/api/items', { method: 'POST', body });
        toast({ title: 'Item created', description: form.name });
      }
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast({
        title: 'Could not save item',
        description: err instanceof ApiError ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-headline text-xl">
            {item ? 'Edit item' : 'New item'}
          </SheetTitle>
          <SheetDescription>
            {item ? `Update details for ${item.name}.` : 'Add a product, ingredient, or packaging item.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-3 px-4 pb-8">
          <SectionTitle>Basics</SectionTitle>
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Cappuccino"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea
              id="item-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short menu description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-sku">SKU</Label>
              <Input id="item-sku" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="DRK-CAP" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-barcode">Barcode</Label>
              <Input id="item-barcode" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
            </div>
          </div>

          <SectionTitle>Classification</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v, subcategoryId: '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {reference.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategory</Label>
              <Select
                value={form.subcategoryId || 'none'}
                onValueChange={(v) => set('subcategoryId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subcategoryOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Station</Label>
              <Select value={form.stationId || 'none'} onValueChange={(v) => set('stationId', v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {reference.stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Item type</Label>
              <Select value={form.itemType || 'none'} onValueChange={(v) => set('itemType', v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="beverage">Beverage</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sale type</Label>
              <Select value={form.saleType} onValueChange={(v) => set('saleType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="dine-in">Dine-in only</SelectItem>
                  <SelectItem value="take-away">Take-away only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sold by</Label>
              <Select value={form.soldBy} onValueChange={(v) => set('soldBy', v as 'each' | 'volume')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Per piece</SelectItem>
                  <SelectItem value="volume">By volume (g/ml)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionTitle>Pricing {form.soldBy === 'volume' && '(per 100 g/ml)'}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-price">Price</Label>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-cost">Cost</Label>
              <Input
                id="item-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
              />
            </div>
          </div>

          <SectionTitle>Inventory</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.inventoryType}
                onValueChange={(v) => set('inventoryType', v as 'simple' | 'composite')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="composite">Composite (recipe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-threshold">Low-stock threshold</Label>
              <Input
                id="item-threshold"
                type="number"
                min="0"
                step="0.01"
                value={form.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', e.target.value)}
              />
            </div>
          </div>
          {form.inventoryType === 'simple' && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <Label htmlFor="item-track" className="cursor-pointer text-sm">
                Track stock for this item
              </Label>
              <Switch
                id="item-track"
                checked={form.trackStock}
                onCheckedChange={(v) => set('trackStock', v)}
              />
            </div>
          )}
          {form.inventoryType === 'composite' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="item-yield">Yield</Label>
                  <Input
                    id="item-yield"
                    type="number"
                    min="1"
                    step="1"
                    value={form.yield}
                    onChange={(e) => set('yield', e.target.value)}
                  />
                </div>
                <p className="self-end text-xs leading-snug text-muted-foreground">
                  Selling 1 of this item consumes each component quantity ÷ yield.
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Components
              </p>
              <div className="space-y-2">
                {form.components.map((comp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={comp.itemId}
                      onValueChange={(v) =>
                        set(
                          'components',
                          form.components.map((c, j) => (j === i ? { ...c, itemId: v } : c))
                        )
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose component" />
                      </SelectTrigger>
                      <SelectContent>
                        {(componentCandidates as Item[])
                          .filter((c) => c.id !== item?.id)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-24"
                      value={comp.quantity}
                      onChange={(e) =>
                        set(
                          'components',
                          form.components.map((c, j) =>
                            j === i ? { ...c, quantity: Number(e.target.value) } : c
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive"
                      onClick={() => set('components', form.components.filter((_, j) => j !== i))}
                      aria-label="Remove component"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set('components', [
                    ...form.components,
                    { itemId: componentCandidates[0]?.id ?? '', quantity: 1 },
                  ])
                }
                disabled={componentCandidates.length === 0}
              >
                <Plus className="h-4 w-4" /> Add component
              </Button>
            </div>
          )}

          <SectionTitle>POS appearance</SectionTitle>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Label htmlFor="item-sellable" className="cursor-pointer text-sm">
              Show on the POS register
            </Label>
            <Switch
              id="item-sellable"
              checked={form.isSellable}
              onCheckedChange={(v) => set('isSellable', v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Label htmlFor="item-color" className="cursor-pointer text-sm">
              Tile color
            </Label>
            <input
              id="item-color"
              type="color"
              value={form.posColor}
              onChange={(e) => set('posColor', e.target.value)}
              className="h-8 w-12 cursor-pointer rounded-md border border-border bg-card p-0.5"
            />
          </div>
          {reference.taxes.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taxes
              </p>
              <div className="flex flex-wrap gap-3">
                {reference.taxes.map((tax) => (
                  <label key={tax.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.taxIds.includes(tax.id)}
                      onCheckedChange={(checked) =>
                        set(
                          'taxIds',
                          checked
                            ? [...form.taxIds, tax.id]
                            : form.taxIds.filter((id) => id !== tax.id)
                        )
                      }
                    />
                    {tax.name} ({tax.rate}%)
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-card px-4 py-3 pt-3">
            <Button type="submit" className="btn-press flex-1" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {item ? 'Save changes' : 'Create item'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
