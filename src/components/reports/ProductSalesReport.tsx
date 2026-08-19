
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SaleWithId, ItemWithId, CategoryWithId } from '@/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { formatCurrency, roundTo } from '@/lib/utils';
import { isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import ReportToolbar from './ReportToolbar';
import { exportToCsv } from '@/lib/csv';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface ProductSalesReportProps {
  sales: SaleWithId[];
  items: ItemWithId[];
  categories: CategoryWithId[];
}

type ProductSaleSummary = {
    itemId: string;
    name: string;
    category: string;
    quantity: number;
    cost: number;
    grossSales: number;
    discountAmount: number;
    netSales: number;
    itemType: string | null;
};

export default function ProductSalesReport({ sales, items, categories }: ProductSalesReportProps) {
  const { settings } = useSettings();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ProductSaleSummary; direction: 'asc' | 'desc' }>({
    key: 'netSales',
    direction: 'desc'
  });

  useEffect(() => {
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
  }, []);

  const handleSort = (key: keyof ProductSaleSummary) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortIcon = (key: keyof ProductSaleSummary) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  const productSummaries = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const summaryMap = new Map<string, ProductSaleSummary>();
    const itemsMap = new Map(items.map(i => [i.id, i]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    // Helper to determine if an item counts as packaging
    const isPackagingItem = (item: ItemWithId) => {
        if (item.itemType === 'packaging') return true;
        const catName = categoryMap.get(item.categoryId)?.toLowerCase();
        return catName === 'packaging' || catName === 'packagings' || catName === 'packaging materials';
    };

    // Helper to determine if an item counts as an ingredient
    const isIngredientItem = (item: ItemWithId) => {
        const catName = categoryMap.get(item.categoryId)?.toLowerCase();
        return catName === 'ingredient' || catName === 'ingredients';
    };

    const filteredSales = sales.filter(sale => 
        isWithinInterval(sale.date.toDate(), { 
            start: startOfDay(dateRange.from!), 
            end: endOfDay(dateRange.to!) 
        })
    );

    const addToSummary = (targetItem: ItemWithId, qty: number, isMainSale: boolean, saleItem?: any) => {
        const summaryKey = targetItem.id;
        const existing = summaryMap.get(summaryKey) || {
            itemId: targetItem.id,
            name: targetItem.name || 'Unknown Item',
            category: categoryMap.get(targetItem.categoryId) || 'N/A',
            quantity: 0,
            cost: 0,
            grossSales: 0,
            discountAmount: 0,
            netSales: 0,
            itemType: targetItem.itemType || (isPackagingItem(targetItem) ? 'packaging' : (isIngredientItem(targetItem) ? 'ingredient' : null))
        };

        existing.quantity = roundTo(existing.quantity + qty);
        existing.cost = roundTo(existing.cost + (targetItem.cost * qty));

        if (isMainSale && saleItem) {
            const gross = saleItem.price * qty;
            const discount = (saleItem.discount?.amount || 0) * (qty / saleItem.quantity);
            const net = gross - discount;

            existing.grossSales = roundTo(existing.grossSales + gross);
            existing.discountAmount = roundTo(existing.discountAmount + discount);
            existing.netSales = roundTo(existing.netSales + net);
        }

        summaryMap.set(summaryKey, existing);
    };

    filteredSales.forEach(sale => {
        sale.items.forEach(si => {
            const item = itemsMap.get(si.itemId);
            if (!item) return;

            const effectiveQty = si.quantity - (si.refundedQuantity || 0);
            if (effectiveQty <= 0) return;

            // 1. PRIMARY PRODUCT SALE (Add if it matches the current filter)
            const actualItemType = item.itemType || 
                (isPackagingItem(item) ? 'packaging' : 
                (isIngredientItem(item) ? 'ingredient' : null));
                
            if (itemTypeFilter === 'all' || actualItemType === itemTypeFilter) {
                addToSummary(item, effectiveQty, true, si);
            }

            // 2. RECURSIVE COMPONENT SCAN (For nested materials/ingredients)
            // When looking at Packaging or Ingredient reports, find hidden items inside composite products
            if (item.inventoryType === 'composite' && (itemTypeFilter === 'packaging' || itemTypeFilter === 'ingredient')) {
                const scanRecursive = (parent: ItemWithId, multiplier: number) => {
                    if (!parent.components) return;

                    const parentYield = parent.yield || 1;
                    const factor = multiplier / parentYield;

                    parent.components.forEach(comp => {
                        const compItem = itemsMap.get(comp.itemId);
                        if (!compItem) return;

                        const compQtyUsed = comp.quantity * factor;
                        const isTarget = itemTypeFilter === 'packaging' 
                            ? isPackagingItem(compItem) 
                            : isIngredientItem(compItem);

                        if (isTarget) {
                            // Found a target component! Add it to the summary.
                            addToSummary(compItem, compQtyUsed, false);
                        }

                        // Keep digging if the component itself is a composite item (nested recipes)
                        if (compItem.inventoryType === 'composite') {
                            scanRecursive(compItem, compQtyUsed);
                        }
                    });
                };
                scanRecursive(item, effectiveQty);
            }
        });
    });

    return Array.from(summaryMap.values()).sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        return sortConfig.direction === 'asc' 
            ? (valA < valB ? -1 : 1) 
            : (valA > valB ? -1 : 1);
    });
  }, [sales, items, categories, dateRange, itemTypeFilter, sortConfig]);

  const totals = useMemo(() => {
      return productSummaries.reduce((acc, curr) => ({
          qty: roundTo(acc.qty + curr.quantity),
          cost: roundTo(acc.cost + curr.cost),
          gross: roundTo(acc.gross + curr.grossSales),
          discount: roundTo(acc.discount + curr.discountAmount),
          net: roundTo(acc.net + curr.netSales)
      }), { qty: 0, cost: 0, gross: 0, discount: 0, net: 0 });
  }, [productSummaries]);

  const handleExport = () => {
    const dataToExport = productSummaries.map(p => ({
        product_name: p.name,
        type: p.itemType || 'N/A',
        category: p.category,
        quantity_sold: p.quantity,
        total_cost: p.cost,
        gross_sales: p.grossSales,
        discounts: p.discountAmount,
        net_sales: p.netSales
    }));
    exportToCsv(dataToExport, `product_sales_${itemTypeFilter}_report`);
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Product Sales Report</CardTitle>
        <CardDescription>Detailed volume and revenue breakdown. The Packaging and Ingredients tabs include materials and components bundled in composite products.</CardDescription>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
            <Tabs value={itemTypeFilter} onValueChange={setItemTypeFilter} className="w-full sm:w-auto">
                <TabsList className="grid grid-cols-5 w-full sm:w-[620px]">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="food">Food</TabsTrigger>
                    <TabsTrigger value="beverage">Beverage</TabsTrigger>
                    <TabsTrigger value="packaging">Packaging</TabsTrigger>
                    <TabsTrigger value="ingredient">Ingredients</TabsTrigger>
                </TabsList>
            </Tabs>
            <ReportToolbar
                dateRange={dateRange}
                onDateChange={setDateRange}
                onExport={handleExport}
            />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-8">
            <Card className="bg-card/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Units Sold</CardTitle>
                </CardHeader>
                <CardContent><div className="text-2xl font-black">{totals.qty}</div></CardContent>
            </Card>
            <Card className="bg-card/50 border-primary/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Total Inventory Cost</CardTitle>
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-primary">{formatCurrency(totals.cost, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Sales</CardTitle>
                </CardHeader>
                <CardContent><div className="text-2xl font-black">{formatCurrency(totals.gross, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Discounts</CardTitle>
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-destructive">-{formatCurrency(totals.discount, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50 border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary font-black">Net Revenue</CardTitle>
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-primary">{formatCurrency(totals.net, settings.currency)}</div></CardContent>
            </Card>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Product Name {renderSortIcon('name')}</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('category')}>
                    <div className="flex items-center">Category {renderSortIcon('category')}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('quantity')}>
                    <div className="flex items-center justify-end">Qty {renderSortIcon('quantity')}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('cost')}>
                    <div className="flex items-center justify-end">Total Cost {renderSortIcon('cost')}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('grossSales')}>
                    <div className="flex items-center justify-end">Gross Sales {renderSortIcon('grossSales')}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('discountAmount')}>
                    <div className="flex items-center justify-end">Discounts {renderSortIcon('discountAmount')}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('netSales')}>
                    <div className="flex items-center justify-end">Net Sales {renderSortIcon('netSales')}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productSummaries.length > 0 ? (
                productSummaries.map(p => (
                  <TableRow key={p.itemId}>
                    <TableCell className="font-medium">
                        <div className="flex flex-col">
                            <span>{p.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{p.itemType || 'N/A'}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.category}</TableCell>
                    <TableCell className="text-right font-mono">{p.quantity}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatCurrency(p.cost, settings.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.grossSales, settings.currency)}</TableCell>
                    <TableCell className="text-right text-destructive">-{formatCurrency(p.discountAmount, settings.currency)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(p.netSales, settings.currency)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground italic">No data found matching your current filters.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
