'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, Timestamp } from 'firebase/firestore';
import { SaleWithId, ItemWithId } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Timer, Play, ChefHat, Coffee, Clock, Check, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';

interface StationDisplayClientProps {
  title: string;
  stationType: 'kitchen' | 'bar';
  loadingText: string;
  itemTypeFilter?: 'food' | 'beverage' | 'packaging';
}

export function StationDisplayClient({ title, stationType, loadingText, itemTypeFilter }: StationDisplayClientProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'sales'),
      where('status', 'in', ['pending', 'preparing'])
    );
  }, [firestore]);
  
  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'items'));
  }, [firestore]);

  const { data: activeSales, isLoading: isLoadingSales } = useCollection<SaleWithId>(salesQuery);
  const { data: items } = useCollection<ItemWithId>(itemsQuery);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const itemsMap = useMemo(() => {
    const map = new Map<string, ItemWithId>();
    if (items) {
      items.forEach(item => map.set(item.id, item));
    }
    return map;
  }, [items]);

  const sortedSales = useMemo(() => {
    if (!activeSales) return [];
    
    // Sort chronologically (oldest tickets first)
    let sorted = [...activeSales].sort((a, b) => {
      const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
      const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    // Filter items based on station itemTypeFilter
    if (itemTypeFilter) {
        sorted = sorted.map(sale => {
            const filteredItems = sale.items.filter(saleItem => {
                const itemData = itemsMap.get(saleItem.itemId);
                if (itemTypeFilter === 'beverage') {
                    return itemData?.itemType === 'beverage';
                }
                if (itemTypeFilter === 'food') {
                    return itemData?.itemType === 'food' || (!itemData?.itemType && itemData?.itemType !== 'beverage');
                }
                return itemData?.itemType === itemTypeFilter;
            });
            return { ...sale, items: filteredItems };
        }).filter(sale => sale.items.length > 0);
    }

    return sorted;
  }, [activeSales, itemsMap, itemTypeFilter]);

  const toggleItemCheck = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdateStatus = (saleId: string, newStatus: 'preparing' | 'completed') => {
    if (!firestore) return;
    try {
        const saleRef = doc(firestore, 'sales', saleId);
        const updateData: any = { status: newStatus };
        if (newStatus === 'completed') {
            updateData.completedAt = Timestamp.now();
        }
        updateDocumentNonBlocking(saleRef, updateData);
        toast({ title: `Order ${newStatus === 'preparing' ? 'In Preparation' : 'Completed'}` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error updating order', description: e.message });
    }
  };

  const getWaitTime = (dateData: any) => {
    const date = dateData instanceof Timestamp ? dateData.toDate() : new Date(dateData);
    return formatDistanceToNow(date, { addSuffix: false });
  };

  const getWaitTimeMs = (dateData: any) => {
    const date = dateData instanceof Timestamp ? dateData.toDate() : new Date(dateData);
    return currentTime.getTime() - date.getTime();
  };

  if (isLoadingSales) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center p-8 space-y-4">
        <div className="p-4 rounded-2xl bg-primary/10 text-primary animate-pulse">
          {stationType === 'bar' ? (
            <Coffee className="h-10 w-10" />
          ) : (
            <ChefHat className="h-10 w-10" />
          )}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{loadingText}</p>
      </div>
    );
  }

  const pendingCount = sortedSales.filter(s => s.status === 'pending').length;
  const preparingCount = sortedSales.filter(s => s.status === 'preparing').length;

  return (
    <div className="flex flex-col h-full bg-background p-4 sm:p-6 space-y-5">
      {/* KDS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 text-primary p-2.5 rounded-2xl shadow-xs">
            {stationType === 'bar' ? (
              <Coffee className="h-6 w-6" />
            ) : (
              <ChefHat className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground font-medium">Real-time live ticket queue</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xs text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{pendingCount} Pending</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xs text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{preparingCount} Preparing</span>
          </div>
        </div>
      </div>

      {/* Orders Horizon */}
      <div className="flex-1 overflow-x-auto pb-4">
        {sortedSales.length === 0 ? (
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-3xl p-8">
             <div className="p-4 rounded-2xl bg-muted/60 text-muted-foreground mb-3">
               <CheckCircle2 className="h-10 w-10 text-emerald-500" />
             </div>
             <p className="text-base font-bold text-foreground">All caught up!</p>
             <p className="text-xs text-muted-foreground mt-1">No active kitchen orders right now.</p>
          </div>
        ) : (
          <div className="flex gap-4 h-full items-start">
            {sortedSales.map(sale => {
              const isPreparing = sale.status === 'preparing';
              const waitMs = getWaitTimeMs(sale.date);
              const isUrgent = waitMs > 15 * 60 * 1000;
              const isWarning = waitMs > 8 * 60 * 1000 && !isUrgent;
              
              return (
                <Card 
                  key={sale.id} 
                  className={cn(
                    "min-w-[320px] max-w-[320px] flex flex-col rounded-2xl shadow-xs border transition-all duration-150 bg-card overflow-hidden",
                    isUrgent && "border-destructive/60 ring-2 ring-destructive/20",
                    !isUrgent && isPreparing && "border-amber-500/60 ring-2 ring-amber-500/20",
                    !isUrgent && !isPreparing && "border-border/80 hover:border-primary/40"
                  )}
                >
                  {/* Card Header with Ticket # and Timer */}
                  <CardHeader className={cn(
                    "p-4 border-b transition-colors",
                    isUrgent ? "bg-destructive/10 border-destructive/20" :
                    isPreparing ? "bg-amber-500/10 border-amber-500/20" :
                    "bg-muted/40 border-border/60"
                  )}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black font-mono tracking-tight text-foreground">
                          #{sale.ticketNumber || sale.id.slice(-4)}
                        </span>
                        {sale.deliveryFee !== undefined ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 uppercase">
                            Delivery
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase">
                            Dine-In
                          </span>
                        )}
                      </div>

                      <div className={cn(
                        "flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full",
                        isUrgent ? "bg-destructive text-destructive-foreground animate-pulse" :
                        isWarning ? "bg-amber-500/20 text-amber-600" :
                        "bg-muted text-muted-foreground"
                      )}>
                        <Timer className="w-3.5 h-3.5" />
                        <span>{getWaitTime(sale.date)}</span>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Items List with Interactive Checkboxes */}
                  <CardContent className="p-0 flex-1 overflow-y-auto max-h-[360px]">
                    <ul className="divide-y divide-border/60">
                      {sale.items.map((saleItem, idx) => {
                        const itemData = itemsMap.get(saleItem.itemId);
                        const itemKey = `${sale.id}-${idx}`;
                        const isChecked = !!checkedItems[itemKey];

                        return (
                          <li 
                            key={idx} 
                            onClick={() => toggleItemCheck(itemKey)}
                            className={cn(
                              "p-3.5 flex gap-3 items-center cursor-pointer transition-colors select-none",
                              isChecked ? "bg-muted/30 opacity-60" : "hover:bg-muted/40"
                            )}
                          >
                            <div className={cn(
                              "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors",
                              isChecked 
                                ? "bg-emerald-500 text-white" 
                                : "bg-primary/10 text-primary"
                            )}>
                              {isChecked ? <Check className="w-4 h-4" /> : saleItem.quantity}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-semibold text-sm leading-tight text-foreground truncate",
                                isChecked && "line-through text-muted-foreground"
                              )}>
                                {itemData?.name || 'Unknown Item'}
                              </p>
                              {itemData?.sku && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{itemData.sku}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>

                  {/* Action Button Footer */}
                  <CardFooter className="p-3.5 border-t border-border/60 bg-muted/20 mt-auto">
                    {sale.status === 'pending' ? (
                      <Button 
                        className="w-full text-xs font-bold h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-transform active:scale-[0.98]" 
                        onClick={() => handleUpdateStatus(sale.id, 'preparing')}
                      >
                        <Play className="w-4 h-4 mr-1.5 fill-current" /> Start Preparing
                      </Button>
                    ) : (
                      <Button 
                        className="w-full text-xs font-bold h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-transform active:scale-[0.98]" 
                        onClick={() => handleUpdateStatus(sale.id, 'completed')}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Ready & Complete
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

