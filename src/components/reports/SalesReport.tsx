
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
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
import { SaleWithId, ItemWithId, CategoryWithId, SubcategoryWithId, StockBatch } from '@/types';
import { useSettings } from '@/contexts/SettingsProvider';
import { formatCurrency, forceInteractivity, roundTo } from '@/lib/utils';
import { format as formatDate, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import ReportToolbar from './ReportToolbar';
import { exportToCsv } from '@/lib/csv';
import { Button } from '../ui/button';
import { Trash2, Loader2, AlertTriangle, ChevronDown, RotateCcw, Receipt, Tag, Truck, DollarSign, ReceiptText, TrendingUp } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface SalesReportProps {
  sales: SaleWithId[];
  items: ItemWithId[];
  categories: CategoryWithId[];
  subcategories: SubcategoryWithId[];
}

async function deleteSaleAction(firestore: any, sale: SaleWithId, allItems: ItemWithId[]) {
    const batch = writeBatch(firestore);
    
    const updatedItemsMap = new Map<string, ItemWithId>(allItems.map(i => [i.id, structuredClone(i)]));

    const restoreStock = (item: ItemWithId, qty: number) => {
        if (!item.trackStock) return;
        if (!item.stockBatches) item.stockBatches = [];
        if (item.stockBatches.length > 0) {
            item.stockBatches[0].quantity = roundTo(item.stockBatches[0].quantity + qty);
        } else {
            item.stockBatches.push({
                id: `restored-${Date.now()}`,
                quantity: roundTo(qty),
                purchaseDate: new Date().toISOString().split('T')[0]
            });
        }
    };

    for (const saleItem of sale.items) {
        const item = updatedItemsMap.get(saleItem.itemId);
        if (!item) continue;

        const effectiveQty = Math.max(0, saleItem.quantity - (saleItem.refundedQuantity || 0));
        if (effectiveQty <= 0) continue;

        if (item.inventoryType === 'simple' && item.trackStock) {
            restoreStock(item, effectiveQty);
        } else if (item.inventoryType === 'composite' && item.components) {
            for (const component of item.components) {
                const componentItem = updatedItemsMap.get(component.itemId);
                if (componentItem && componentItem.trackStock) {
                    restoreStock(componentItem, component.quantity * effectiveQty);
                }
            }
        }
    }

    for (const item of updatedItemsMap.values()) {
        const originalItem = allItems.find(i => i.id === item.id);
        if (originalItem && JSON.stringify(originalItem.stockBatches) !== JSON.stringify(item.stockBatches)) {
            batch.update(doc(firestore, 'items', item.id), { stockBatches: item.stockBatches });
        }
    }

    batch.delete(doc(firestore, 'sales', sale.id));
    await batch.commit();
}

async function refundItemsAction(firestore: any, sale: SaleWithId, itemIndex: number, refundQty: number, allItems: ItemWithId[]) {
    const saleRef = doc(firestore, 'sales', sale.id);
    const updatedItems = [...sale.items];
    const currentItem = { ...updatedItems[itemIndex] };
    
    const maxRefundable = currentItem.quantity - (currentItem.refundedQuantity || 0);
    if (refundQty > maxRefundable) throw new Error("Refund quantity exceeds available balance.");

    currentItem.refundedQuantity = roundTo((currentItem.refundedQuantity || 0) + refundQty);
    updatedItems[itemIndex] = currentItem;

    const batch = writeBatch(firestore);
    
    const item = allItems.find(i => i.id === currentItem.itemId);
    if (item && item.trackStock) {
        const restoreStockRecursive = (targetItem: ItemWithId, qty: number) => {
            if (targetItem.inventoryType === 'simple') {
                const itemRef = doc(firestore, 'items', targetItem.id);
                const batches = [...(targetItem.stockBatches || [])];
                if (batches.length > 0) {
                    batches[0].quantity = roundTo(batches[0].quantity + qty);
                } else {
                    batches.push({
                        id: `refund-${Date.now()}`,
                        quantity: roundTo(qty),
                        purchaseDate: new Date().toISOString().split('T')[0]
                    });
                }
                batch.update(itemRef, { stockBatches: batches });
            } else if (targetItem.inventoryType === 'composite' && targetItem.components) {
                for (const comp of targetItem.components) {
                    const compItem = allItems.find(i => i.id === comp.itemId);
                    if (compItem) restoreStockRecursive(compItem, comp.quantity * qty);
                }
            }
        };
        restoreStockRecursive(item, refundQty);
    }

    batch.update(saleRef, { items: updatedItems });
    await batch.commit();
}

export default function SalesReport({ sales, items, categories, subcategories }: SalesReportProps) {
  const { settings } = useSettings();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [saleToDelete, setSaleToDelete] = useState<SaleWithId | null>(null);
  const [refundTarget, setRefundTarget] = useState<{ sale: SaleWithId, itemIndex: number } | null>(null);
  const [refundQuantity, setRefundQuantity] = useState<number>(0);
  const [isActionPending, startActionTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
  }, []);

  useEffect(() => {
    if (!saleToDelete && !refundTarget && !isActionPending) {
        forceInteractivity();
    }
  }, [saleToDelete, refundTarget, isActionPending]);
  
  const filteredSales = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    return sales
      .filter(sale => isWithinInterval(sale.date.toDate(), { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to!) }))
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [sales, dateRange]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalDiscounts = 0;
    let totalDeliveryFees = 0;
    let totalRefunds = 0;

    filteredSales.forEach(sale => {
        totalRevenue += sale.total;
        totalDeliveryFees += (sale.deliveryFee || 0);
        
        if (sale.discount) {
            totalDiscounts += (sale.discount.amount || 0);
        }

        sale.items.forEach(si => {
            if (si.discount) {
                totalDiscounts += (si.discount.amount || 0);
            }

            const item = items.find(i => i.id === si.itemId);
            if (item) {
                const effectiveQty = si.quantity - (si.refundedQuantity || 0);
                totalCogs += (item.cost || 0) * effectiveQty;
                if (si.refundedQuantity) {
                    totalRefunds += (si.refundedQuantity * si.price);
                }
            }
        });
    });

    const totalSales = filteredSales.length;
    const netSales = totalRevenue - totalRefunds;
    const totalProfit = netSales - totalCogs;
    const profitMargin = netSales > 0 ? (totalProfit / netSales) * 100 : 0;

    return {
        totalRevenue,
        totalSales,
        totalCogs,
        totalDiscounts,
        totalDeliveryFees,
        totalRefunds,
        netSales,
        totalProfit,
        profitMargin
    };
  }, [filteredSales, items]);

  const handleExport = () => {
    const dataToExport = filteredSales.map(sale => {
        const productNames: string[] = [];
        sale.items.forEach(si => {
            const item = items.find(i => i.id === si.itemId);
            let name = `${si.quantity}x ${item?.name || 'Unknown'}`;
            if (si.refundedQuantity) name += ` (Refunded: ${si.refundedQuantity})`;
            productNames.push(name);
        });

        return {
            date: formatDate(sale.date.toDate(), 'yyyy-MM-dd HH:mm:ss'),
            total: sale.total,
            items: productNames.join('; ')
        };
    });
    exportToCsv(dataToExport, 'sales_report');
  };

  const handleDelete = () => {
    if (!saleToDelete) return;
    startActionTransition(async () => {
        try {
            await deleteSaleAction(firestore, saleToDelete, items);
            toast({ title: 'Success', description: 'Sale deleted and stock restored.' });
        } catch (error) {
      console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setSaleToDelete(null);
        }
    });
  };

  const handleRefund = () => {
      if (!refundTarget) return;
      startActionTransition(async () => {
          try {
              await refundItemsAction(firestore, refundTarget.sale, refundTarget.itemIndex, refundQuantity, items);
              toast({ title: 'Refund Complete', description: 'Item(s) refunded and inventory updated.' });
          } catch (error) {
      console.error(error);
              toast({ variant: 'destructive', title: 'Refund Failed', description: (error as Error).message });
          } finally {
              setRefundTarget(null);
              setRefundQuantity(0);
          }
      });
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Sales Report</CardTitle>
        <CardDescription>A detailed breakdown of all sales. Click on a row to see individual items.</CardDescription>
        <ReportToolbar
          dateRange={dateRange}
          onDateChange={setDateRange}
          onExport={handleExport}
        />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-8">
            <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Receipts</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black">{stats.totalSales}</div></CardContent>
            </Card>
            <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black">{formatCurrency(stats.totalRevenue, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50 border-primary/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Net Sales (After Refunds)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-primary">{formatCurrency(stats.netSales, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50 border-accent/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-accent">Total COGS</CardTitle>
                    <ReceiptText className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-accent">{formatCurrency(stats.totalCogs, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50 border-primary/20 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary font-black">Estimated Profit</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className={cn("text-2xl font-black", stats.totalProfit >= 0 ? "text-primary" : "text-destructive")}>
                        {formatCurrency(stats.totalProfit, settings.currency)}
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profit Margin %</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black">{stats.profitMargin.toFixed(2)}%</div>
                </CardContent>
            </Card>
            <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery Fees</CardTitle>
                    <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-primary">{formatCurrency(stats.totalDeliveryFees, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Discounts</CardTitle>
                    <Tag className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-destructive">-{formatCurrency(stats.totalDiscounts, settings.currency)}</div></CardContent>
            </Card>
            <Card className="bg-card/50 border-red-100 dark:border-red-950">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Total Refunds</CardTitle>
                    <RotateCcw className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent><div className="text-2xl font-black text-destructive">-{formatCurrency(stats.totalRefunds, settings.currency)}</div></CardContent>
            </Card>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            {filteredSales.length > 0 ? (
              filteredSales.map(sale => (
                <Collapsible key={sale.id} asChild>
                  <TableBody className="border-b last:border-b-0">
                    <TableRow className="cursor-pointer group">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="font-medium">{formatDate(sale.date.toDate(), 'PPP p')}</TableCell>
                      <TableCell>{sale.items.reduce((acc, item) => acc + item.quantity, 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.subtotal || sale.total, settings.currency)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(sale.total, settings.currency)}</TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setSaleToDelete(sale); }}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30 border-b-0 hover:bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-12 py-4 space-y-3">
                              <div className="space-y-2">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Items Sold</h4>
                                  <div className="grid gap-2">
                                      {sale.items.map((si, idx) => {
                                          const item = items.find(i => i.id === si.itemId);
                                          const itemName = item?.name || 'Unknown Item';
                                          const isFullyRefunded = si.refundedQuantity === si.quantity;
                                          
                                          return (
                                              <div key={idx} className="flex items-center justify-between p-2 rounded bg-background border">
                                                  <div className="flex flex-col">
                                                      <span className={cn("font-medium text-sm", isFullyRefunded && "line-through opacity-50")}>
                                                          {si.quantity}x {itemName}
                                                      </span>
                                                      {si.refundedQuantity ? (
                                                          <span className="text-[10px] text-destructive font-bold">Refunded: {si.refundedQuantity}</span>
                                                      ) : null}
                                                  </div>
                                                  <div className="flex items-center gap-4">
                                                      <span className="text-sm font-semibold">{formatCurrency(si.price * si.quantity, settings.currency)}</span>
                                                      {!isFullyRefunded && (
                                                          <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-7 text-[10px] gap-1"
                                                            onClick={() => {
                                                                setRefundTarget({ sale, itemIndex: idx });
                                                                setRefundQuantity(si.quantity - (si.refundedQuantity || 0));
                                                            }}
                                                          >
                                                              <RotateCcw className="h-3 w-3" /> Refund
                                                          </Button>
                                                      )}
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </TableBody>
                </Collapsible>
              ))
            ) : (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No sales in this period.</TableCell>
                </TableRow>
              </TableBody>
            )}
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={!!saleToDelete} onOpenChange={(open) => !open && !isActionPending && setSaleToDelete(null)}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delete Sale Record?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete this sale and restore the remaining non-refunded quantities to your inventory.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isActionPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Record"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && !isActionPending && setRefundTarget(null)}>
          <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                  <DialogTitle>Refund Item</DialogTitle>
                  <DialogDescription>
                      How many units of "{refundTarget && items.find(i => i.id === refundTarget.sale.items[refundTarget.itemIndex].itemId)?.name}" would you like to refund?
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div className="space-y-2">
                      <Label>Quantity to Refund</Label>
                      <Input 
                        type="number" 
                        max={refundTarget ? (refundTarget.sale.items[refundTarget.itemIndex].quantity - (refundTarget.sale.items[refundTarget.itemIndex].refundedQuantity || 0)) : 0}
                        value={refundQuantity}
                        onChange={(e) => setRefundQuantity(Number(e.target.value))}
                      />
                      <p className="text-[10px] text-muted-foreground italic">
                          This quantity will be added back to your inventory stock.
                      </p>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={isActionPending}>Cancel</Button>
                  <Button onClick={handleRefund} disabled={isActionPending || refundQuantity <= 0}>
                      {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Process Refund
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
  );
}
