'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, MoreHorizontal, PackagePlus, Pencil, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ItemFormSheet } from './ItemFormSheet';
import { BatchesDialog } from './BatchesDialog';
import { api, ApiError } from '@/lib/api-client';
import { displayCost, formatMoney, round3 } from '@/lib/money';
import { totalStockOf } from './helpers';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsProvider';
import type { Category, Item, Station, Subcategory, Tax } from '@/lib/types';

interface ReferenceData {
  categories: Category[];
  subcategories: Subcategory[];
  stations: Station[];
  taxes: Tax[];
}

export function ItemsClient() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [ref, setRef] = useState<ReferenceData>({ categories: [], subcategories: [], stations: [], taxes: [] });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formItem, setFormItem] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [batchesItem, setBatchesItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);

  const reload = async () => {
    const [itemsRes, cats, subs, stations, taxes] = await Promise.all([
      api<{ items: Item[] }>('/api/items'),
      api<{ categories: Category[] }>('/api/categories'),
      api<{ subcategories: Subcategory[] }>('/api/subcategories'),
      api<{ stations: Station[] }>('/api/stations'),
      api<{ taxes: Tax[] }>('/api/taxes'),
    ]);
    setItems(itemsRes.items);
    setRef({
      categories: cats.categories,
      subcategories: subs.subcategories,
      stations: stations.stations,
      taxes: taxes.taxes,
      allItems: itemsRes.items,
    });
  };

  useEffect(() => {
    void reload().catch(() => toast({ title: 'Could not load items', variant: 'destructive' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const openCreate = () => {
    setFormItem(null);
    setFormOpen(true);
  };
  const openEdit = (item: Item) => {
    setFormItem(item);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await api(`/api/items/${deleteItem.id}`, { method: 'DELETE' });
      toast({ title: 'Item deleted', description: deleteItem.name });
      await reload();
    } catch (e) {
      toast({
        title: 'Could not delete',
        description: e instanceof ApiError ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const categoryOf = (id: string) => ref.categories.find((c) => c.id === id);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-headline text-3xl font-semibold tracking-tight">Items</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your menu and inventory catalog.</p>
        </div>
        <Button className="btn-press ml-auto" onClick={openCreate}>
          <PackagePlus className="h-4 w-4" />
          Add item
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, SKU…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ref.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {items ? `${filtered.length} of ${items.length} items` : ''}
        </span>
      </div>

      {!items && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {items && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-warm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const stock = round3(totalStockOf(item));
                const cat = categoryOf(item.categoryId);
                const out = item.trackStock && stock <= 0;
                const low = item.trackStock && stock > 0 && stock <= item.lowStockThreshold;
                return (
                  <TableRow key={item.id} className="cursor-default">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-8 w-1.5 shrink-0 rounded-full"
                          style={{ background: item.posColor }}
                        />
                        <div>
                          <p className="font-medium leading-tight">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku || '—'}</p>
                        </div>
                        {item.isSellable && (
                          <Badge variant="outline" className="border-primary/25 text-primary">
                            Sellable
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.isSellable ? formatMoney(item.price, settings.currency) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {displayCost(item.cost, item.soldBy, settings.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.trackStock ? (
                        <span className="tabular-nums">
                          {stock}{' '}
                          {item.soldBy === 'volume' ? 'g·ml' : 'pc'}
                          {out && (
                            <Badge variant="destructive" className="ml-1.5">Out</Badge>
                          )}
                          {low && <Badge className="ml-1.5 bg-amber-500/90">Low</Badge>}
                        </span>
                      ) : item.inventoryType === 'composite' ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Layers className="h-3.5 w-3.5" /> recipe
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {item.inventoryType === 'composite' ? 'Composite' : 'Simple'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {item.trackStock && (
                            <DropdownMenuItem onClick={() => setBatchesItem(item)}>
                              <Layers className="h-4 w-4" /> View batches
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No items match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ItemFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        item={formItem}
        reference={ref}
        onSaved={reload}
      />

      <BatchesDialog
        item={batchesItem}
        currency={settings.currency}
        onClose={() => setBatchesItem(null)}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteItem?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from your catalog. Sales history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
