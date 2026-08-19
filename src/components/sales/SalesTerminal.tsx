
'use client';

import { useState, useMemo, useEffect } from 'react';
import { ItemWithId, Sale, StockBatch, CartItem, SubcategoryWithId, SaleWithId, CategoryWithId } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Plus, Minus, Trash2, Loader2, Calendar as CalendarIcon, ShoppingCart, X, History, AlertTriangle, ChevronDown, ChevronUp, Tag, Truck, LayoutGrid, List, ChevronLeft, Search, CheckCircle2, Printer } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from '@/contexts/SettingsProvider';
import { formatCurrency, cn, forceInteractivity, roundTo } from '@/lib/utils';
import { BluetoothThermalPrinter } from '@/lib/bluetoothPrinter';
import { generateReceipt } from '@/lib/receiptGenerator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, collection, Timestamp, query, orderBy, limit } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { useAuth as useAppAuth } from '@/components/auth/AuthProvider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

async function createSaleAction(firestore: any, saleData: Sale, itemsToUpdate: {id: string, stockBatches: StockBatch[]}[]) {
    const batch = writeBatch(firestore);
    const saleRef = doc(collection(firestore, 'sales'));
    
    const sanitizedSale: any = {
        date: saleData.date instanceof Timestamp ? saleData.date : Timestamp.fromDate(new Date(saleData.date)),
        total: Number(saleData.total),
        subtotal: Number(saleData.subtotal || saleData.total),
        userId: saleData.userId || null,
        status: saleData.status || 'pending',
        ticketNumber: saleData.ticketNumber || Math.floor(100 + Math.random() * 900).toString(),
        items: saleData.items.map(item => {
            const sanitizedItem: any = {
                itemId: item.itemId,
                quantity: Number(item.quantity),
                price: Number(item.price)
            };
            if (item.discount) {
                sanitizedItem.discount = {
                    type: item.discount.type,
                    value: Number(item.discount.value),
                    amount: Number(item.discount.amount)
                };
            }
            return sanitizedItem;
        })
    };

    if (saleData.discount) {
        sanitizedSale.discount = {
            type: saleData.discount.type,
            value: Number(saleData.discount.value),
            amount: Number(saleData.discount.amount)
        };
    }

    if (saleData.deliveryFee !== undefined && saleData.deliveryFee !== null) {
        sanitizedSale.deliveryFee = Number(saleData.deliveryFee);
    }

    batch.set(saleRef, sanitizedSale);

    for (const item of itemsToUpdate) {
        const itemRef = doc(firestore, 'items', item.id);
        batch.update(itemRef, { stockBatches: item.stockBatches });
    }

    await batch.commit();
};

async function deleteSaleAction(firestore: any, sale: SaleWithId, allItems: ItemWithId[]) {
    const batch = writeBatch(firestore);
    const updatedItemsMap = new Map<string, ItemWithId>(allItems.map(i => [i.id, structuredClone(i)]));

    const restoreStock = (item: ItemWithId, qty: number) => {
        if (!item.trackStock) return;
        if (!item.stockBatches) item.stockBatches = [];
        
        if (item.stockBatches.length > 0) {
            item.stockBatches[0].quantity = roundTo(Number(item.stockBatches[0].quantity || 0) + Number(qty));
        } else {
            item.stockBatches.push({
                id: `restored-${Date.now()}`,
                quantity: roundTo(Number(qty)),
                purchaseDate: new Date().toISOString().split('T')[0]
            });
        }
    };

    for (const saleItem of sale.items) {
        const item = updatedItemsMap.get(saleItem.itemId);
        if (!item) continue;

        if (item.inventoryType === 'simple' && item.trackStock) {
            restoreStock(item, saleItem.quantity);
        } else if (item.inventoryType === 'composite' && item.components) {
            for (const component of item.components) {
                const componentItem = updatedItemsMap.get(component.itemId);
                 if (componentItem && componentItem.trackStock) {
                    restoreStock(componentItem, component.quantity * saleItem.quantity);
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

const CartItemsList = ({
    cart,
    updateCartQuantity,
    removeFromCart,
    updateItemDiscount,
    settings
}: {
    cart: CartItem[],
    updateCartQuantity: (itemId: string, amount: number) => void;
    removeFromCart: (itemId: string) => void;
    updateItemDiscount: (itemId: string, type: 'percent' | 'fixed' | 'none', value: number) => void;
    settings: any;
}) => (
    <div className="p-4 space-y-2">
        {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50">
                <ShoppingCart className="h-12 w-12 mb-2" />
                <p>No items in cart.</p>
            </div>
        ) : (
            cart.map(item => {
                const itemGrossTotal = item.price * item.quantity;
                const itemDiscountAmount = item.discount?.amount || 0;
                const itemNetTotal = itemGrossTotal - itemDiscountAmount;

                return (
                    <div key={item.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <div className="flex items-center gap-2">
                                    <p className={cn("text-xs", itemDiscountAmount > 0 ? "text-muted-foreground line-through" : "text-muted-foreground")}>
                                        {formatCurrency(item.price, settings.currency)}
                                    </p>
                                    {itemDiscountAmount > 0 && (
                                        <p className="text-xs text-primary font-bold">
                                            {formatCurrency(itemNetTotal / item.quantity, settings.currency)}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateCartQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateCartQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                            <div className="flex items-center gap-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant={itemDiscountAmount > 0 ? "default" : "ghost"} size="icon" className="h-8 w-8 rounded-full" title="Item Discount">
                                            <Tag className="h-3.5 w-3.5" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-4 space-y-3" align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item Discount</p>
                                            {item.discount && (
                                                <Button 
                                                    type="button"
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-6 px-2 text-[10px] text-destructive"
                                                    onClick={() => updateItemDiscount(item.id, 'none', 0)}
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex p-1 bg-muted rounded-lg">
                                                <Button 
                                                    type="button"
                                                    variant={item.discount?.type === 'percent' ? 'default' : 'ghost'} 
                                                    size="sm" 
                                                    className="flex-1 h-7 rounded-md text-[10px] font-bold"
                                                    onClick={() => updateItemDiscount(item.id, 'percent', item.discount?.value || 0)}
                                                >
                                                    %
                                                </Button>
                                                <Button 
                                                    type="button"
                                                    variant={item.discount?.type === 'fixed' ? 'default' : 'ghost'} 
                                                    size="sm" 
                                                    className="flex-1 h-7 rounded-md text-[10px] font-bold"
                                                    onClick={() => updateItemDiscount(item.id, 'fixed', item.discount?.value || 0)}
                                                >
                                                    {formatCurrency(0, settings.currency).replace('0.00', '')}
                                                </Button>
                                            </div>
                                            <Input 
                                                type="number" 
                                                value={item.discount?.value || ''} 
                                                onChange={(e) => updateItemDiscount(item.id, item.discount?.type || 'percent', Number(e.target.value))} 
                                                placeholder="0" 
                                                className="h-9 w-20 text-center font-bold"
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10" onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                        {itemDiscountAmount > 0 && (
                            <div className="flex justify-end px-1">
                                <p className="text-[10px] font-medium text-destructive">
                                    Item Discount: -{formatCurrency(itemDiscountAmount, settings.currency)}
                                </p>
                            </div>
                        )}
                    </div>
                )
            })
        )}
    </div>
);


export default function SalesTerminal({ 
    initialItems: items, 
    initialCategories: categories, 
    initialSubcategories: subcategories 
}: { 
    initialItems: ItemWithId[], 
    initialCategories: CategoryWithId[], 
    initialSubcategories: SubcategoryWithId[] 
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleDate, setSaleDate] = useState<Date | undefined>(new Date());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleWithId | null>(null);
  
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | 'none'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  const [viewMode, setViewMode] = useState<'subcategory' | 'all'>('subcategory');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { toast } = useToast();
  const { settings } = useSettings();
  const firestore = useFirestore();
  const { appUser } = useAppAuth();
  const isMobile = useIsMobile();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<string>(settings.defaultSaleType || 'dine-in');

  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sales'), orderBy('date', 'desc'), limit(20));
  }, [firestore]);
  const { data: recentSales } = useCollection<SaleWithId>(salesQuery);

  useEffect(() => {
    const active = !!saleToDelete || isHistoryOpen || isCartOpen || isProcessing;
    if (!active) {
        forceInteractivity();
    }
  }, [saleToDelete, isHistoryOpen, isCartOpen, isProcessing]);

  const sellableItems = useMemo(() => items.filter(item => item.isSellable), [items]);

  const activeTabItems = useMemo(() => {
    return sellableItems.filter(i => i.saleType === activeTab);
  }, [sellableItems, activeTab]);

  const activeSubcategories = useMemo(() => {
      const subIdsInUse = new Set(activeTabItems.map(i => i.subcategoryId).filter(Boolean));
      const hasUncategorized = activeTabItems.some(i => !i.subcategoryId);
      
      const subs = subcategories
        .filter(s => subIdsInUse.has(s.id))
        .map(s => {
            const parentCat = categories.find(c => c.id === s.categoryId);
            return {
                id: s.id,
                name: s.name,
                color: parentCat?.color || 'hsl(var(--muted))'
            };
        });

      if (hasUncategorized) {
          subs.push({ id: '__none__', name: 'Miscellaneous', color: 'hsl(var(--muted))' });
      }

      return subs.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeTabItems, subcategories, categories]);

  const displayItems = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    if (queryLower) {
        return activeTabItems.filter(item => 
            item.name.toLowerCase().includes(queryLower) || 
            (item.sku && item.sku.toLowerCase().includes(queryLower))
        );
    }

    if (viewMode === 'all') return activeTabItems;
    if (selectedSubcategoryId) {
        if (selectedSubcategoryId === '__none__') {
            return activeTabItems.filter(item => !item.subcategoryId);
        }
        return activeTabItems.filter(item => item.subcategoryId === selectedSubcategoryId);
    }
    return [];
  }, [activeTabItems, viewMode, selectedSubcategoryId, searchQuery]);

  const addToCart = (item: ItemWithId) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...prevCart, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId: string, amount: number) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id === itemId) {
          const newQty = Math.max(0, item.quantity + amount);
          if (item.discount) {
              const itemGross = item.price * newQty;
              const newAmount = item.discount.type === 'percent' 
                ? (itemGross * item.discount.value) / 100 
                : Math.min(item.discount.value, itemGross);
              return { ...item, quantity: newQty, discount: { ...item.discount, amount: newAmount } };
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
      return updatedCart.filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const updateItemDiscount = (itemId: string, type: 'percent' | 'fixed' | 'none', value: number) => {
      setCart(prevCart => prevCart.map(item => {
          if (item.id !== itemId) return item;
          if (type === 'none') return { ...item, discount: undefined };
          
          const itemGross = item.price * item.quantity;
          const amount = type === 'percent' 
            ? (itemGross * value) / 100 
            : Math.min(value, itemGross);

          return { ...item, discount: { type, value, amount } };
      }));
  };
  
  const cartSubtotal = useMemo(() => cart.reduce((total, item) => total + item.price * item.quantity, 0), [cart]);
  const cartNetSubtotal = useMemo(() => cart.reduce((total, item) => total + (item.price * item.quantity) - (item.discount?.amount || 0), 0), [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'none') return 0;
    if (discountType === 'percent') return (cartNetSubtotal * discountValue) / 100;
    return Math.min(discountValue, cartNetSubtotal);
  }, [cartNetSubtotal, discountType, discountValue]);

  const finalDeliveryFee = isDelivery ? deliveryFee : 0;
  const cartTotal = Math.max(0, cartNetSubtotal - discountAmount + finalDeliveryFee);

  const handleCompleteSale = async () => {
    if (!saleDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a sale date.' });
        return;
    }
    setIsProcessing(true);

    try {
      const updatedItemsMap = new Map<string, ItemWithId>(items.map(i => [i.id, structuredClone(i)]));
      const itemsToUpdate: {id: string, stockBatches: StockBatch[]}[] = [];

      for (const cartItem of cart) {
        const itemToUpdate = updatedItemsMap.get(cartItem.id);
        if (!itemToUpdate) continue;

        if (itemToUpdate.inventoryType === 'simple' && itemToUpdate.trackStock) {
            deductStock(itemToUpdate, cartItem.quantity);
        } else if (itemToUpdate.inventoryType === 'composite' && itemToUpdate.components) {
            for (const component of itemToUpdate.components) {
                const componentItem = updatedItemsMap.get(component.itemId);
                 if (componentItem && componentItem.trackStock) {
                    deductStock(componentItem, component.quantity * cartItem.quantity);
                }
            }
        }
      }

      for (const item of updatedItemsMap.values()) {
        const originalItem = items.find(i => i.id === item.id);
        if (originalItem && JSON.stringify(originalItem.stockBatches) !== JSON.stringify(item.stockBatches)) {
          itemsToUpdate.push({ id: item.id, stockBatches: item.stockBatches });
        }
      }

      const saleData: Sale = {
          id: '',
          date: saleDate.toISOString(),
          total: cartTotal,
          subtotal: cartSubtotal,
          userId: appUser?.uid || undefined,
          deliveryFee: isDelivery ? deliveryFee : undefined,
          status: 'pending',
          ticketNumber: Math.floor(100 + Math.random() * 900).toString(),
          items: cart.map(ci => {
              const itemObj: any = { 
                  itemId: ci.id, 
                  quantity: ci.quantity, 
                  price: ci.price
              };
              if (ci.discount) itemObj.discount = ci.discount;
              return itemObj;
          }),
      };

      if (discountType !== 'none') {
          saleData.discount = {
              type: discountType,
              value: discountValue,
              amount: discountAmount,
          };
      }

      await createSaleAction(firestore, saleData, itemsToUpdate);

      setCart([]);
      setDiscountType('none');
      setDiscountValue(0);
      setIsDelivery(false);
      setDeliveryFee(0);
      setSaleDate(new Date());
      setIsCartOpen(false);
      toast({ title: 'Sale Complete!', description: `Inventory has been updated.` });

    } catch (error) {
      console.error(error);
       toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
        setIsProcessing(false);
        forceInteractivity();
    }
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;
    setIsProcessing(true);
    try {
        await deleteSaleAction(firestore, saleToDelete, items);
        toast({ title: 'Sale Deleted', description: 'Transaction record removed and stock restored.' });
    } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
        setIsProcessing(false);
        setSaleToDelete(null);
        forceInteractivity();
    }
  };

  const handlePrintReceipt = async (sale: SaleWithId) => {
    try {
        const printer = new BluetoothThermalPrinter();
        const savedPrinterName = localStorage.getItem('pos_preferred_printer') || undefined;
        const deviceName = await printer.connect(savedPrinterName);
        if (!deviceName) return; // User cancelled
        const itemsMap = new Map<string, ItemWithId>(items.map(i => [i.id, i]));
        const receiptBytes = generateReceipt(sale, itemsMap, settings);
        await printer.print(receiptBytes);
        toast({ title: 'Printing...', description: 'Receipt sent to printer.' });
    } catch (error) {
        console.error('Print failed:', error);
        toast({ variant: 'destructive', title: 'Print Error', description: (error as Error).message });
    }
  };

  const deductStock = (item: ItemWithId, quantityToDeduct: number) => {
    if (!item.trackStock || !item.stockBatches) return;
    
    let totalStock = item.stockBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
    totalStock = roundTo(totalStock);

    if(totalStock < quantityToDeduct) {
        throw new Error(`Not enough stock for ${item.name} (ID: ${item.id}). Required: ${quantityToDeduct}, Available: ${totalStock}.`);
    }

    const sortedBatches = [...item.stockBatches].sort((a, b) => {
        if (a.expiryDate && b.expiryDate) return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        if (a.expiryDate) return -1;
        if (b.expiryDate) return 1;
        return 0;
    });

    let remainingToDeduct = Number(quantityToDeduct);

    for (const batch of sortedBatches) {
        if (remainingToDeduct <= 0) break;

        const originalBatch = item.stockBatches.find(b => b.id === batch.id)!;
        const currentBatchQty = Number(originalBatch.quantity || 0);
        const deductFromThisBatch = Math.min(remainingToDeduct, currentBatchQty);
        
        originalBatch.quantity = roundTo(currentBatchQty - deductFromThisBatch);
        remainingToDeduct = roundTo(remainingToDeduct - deductFromThisBatch);
    }
    
    item.stockBatches = item.stockBatches.filter(b => Number(b.quantity) > 0);
  };

  const renderItemGrid = (filteredItems: ItemWithId[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
      {filteredItems.map(item => {
        const inCartItem = cart.find(c => c.id === item.id);
        const inCartQty = inCartItem?.quantity || 0;

        return (
          <Card 
              key={item.id} 
              onClick={() => addToCart(item)} 
              className={cn(
                "group cursor-pointer rounded-2xl transition-all duration-200 overflow-hidden flex flex-col h-full border shadow-xs select-none active:scale-[0.98] relative",
                inCartQty > 0 
                  ? "border-primary/50 ring-2 ring-primary/20 bg-card shadow-sm" 
                  : "border-border/60 hover:border-primary/40 hover:shadow-md bg-card"
              )}
          >
            {/* Quantity In Cart Indicator Badge */}
            {inCartQty > 0 && (
              <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-in zoom-in-50 duration-150">
                <CheckCircle2 className="h-3 w-3" />
                <span>{inCartQty}</span>
              </div>
            )}

            <CardContent className="p-0 aspect-square relative overflow-hidden bg-muted/40">
              <Image
                src={item.imageUrl || `https://placehold.co/300x300.png`}
                alt={item.name}
                width={300}
                height={300}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="product image"
              />
            </CardContent>
            <CardFooter className="p-3 flex flex-col items-start bg-card mt-auto border-t border-border/50 gap-0.5">
              <p className="font-semibold text-xs text-foreground truncate w-full group-hover:text-primary transition-colors">
                {item.name}
              </p>
              <div className="flex items-center justify-between w-full">
                <p className="text-xs text-primary font-bold">{formatCurrency(item.price, settings.currency)}</p>
                {item.sku && (
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[70px]">
                    {item.sku}
                  </span>
                )}
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );

  const renderSubcategoryGrid = () => (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {activeSubcategories.map(sub => (
              <Card 
                  key={sub.id} 
                  onClick={() => setSelectedSubcategoryId(sub.id)}
                  className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200 aspect-square flex flex-col items-center justify-center p-6 text-center border rounded-2xl group active:scale-[0.98] bg-card"
                  style={{ borderColor: `${sub.color}30` }}
              >
                  <div 
                    className="h-14 w-14 rounded-2xl mb-3 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: sub.color }}
                  >
                      <LayoutGrid className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm tracking-tight text-foreground line-clamp-1">{sub.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">
                    {activeTabItems.filter(i => (sub.id === '__none__' ? !i.subcategoryId : i.subcategoryId === sub.id)).length} Products
                  </p>
              </Card>
          ))}
      </div>
  );

  const navigationHeader = (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 p-3.5 sm:p-4 border-b space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products by name or SKU..."
                    className="pl-9 pr-8 h-9 text-xs rounded-xl bg-muted/40 border-border/70 focus:bg-background transition-colors"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Sale Type Tabs */}
            <Tabs 
                value={activeTab} 
                onValueChange={(v) => { setActiveTab(v); setSelectedSubcategoryId(null); }} 
                className="w-full sm:w-auto"
            >
                <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted/50 rounded-xl">
                    <TabsTrigger value="dine-in" className="text-xs font-bold rounded-lg px-3">Dine In</TabsTrigger>
                    <TabsTrigger value="take-away" className="text-xs font-bold rounded-lg px-3">Take Away</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* View Mode */}
            {!searchQuery && (
              <div className="flex p-1 bg-muted/50 rounded-xl">
                  <Button 
                      variant={viewMode === 'subcategory' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="h-7 rounded-lg text-xs font-bold gap-1.5 px-2.5"
                      onClick={() => { setViewMode('subcategory'); setSelectedSubcategoryId(null); }}
                  >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Categories
                  </Button>
                  <Button 
                      variant={viewMode === 'all' ? 'default' : 'ghost'} 
                      size="sm" 
                      className="h-7 rounded-lg text-xs font-bold gap-1.5 px-2.5"
                      onClick={() => { setViewMode('all'); setSelectedSubcategoryId(null); }}
                  >
                      <List className="h-3.5 w-3.5" />
                      All
                  </Button>
              </div>
            )}
        </div>

        {/* Breadcrumb if Subcategory is selected */}
        {!searchQuery && viewMode === 'subcategory' && selectedSubcategoryId && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-150">
                <Button variant="outline" size="sm" onClick={() => setSelectedSubcategoryId(null)} className="h-7 rounded-lg text-xs font-semibold px-2.5">
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                </Button>
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">/</span>
                    <span className="font-bold text-foreground">
                        {selectedSubcategoryId === '__none__' ? 'Miscellaneous' : subcategories.find(s => s.id === selectedSubcategoryId)?.name}
                    </span>
                    <span className="text-muted-foreground">({displayItems.length} items)</span>
                </div>
            </div>
        )}

        {searchQuery && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Search results for &ldquo;<span className="font-semibold text-foreground">{searchQuery}</span>&rdquo;</span>
                <span className="font-semibold text-primary">{displayItems.length} found</span>
            </div>
        )}
    </div>
  );

  const itemGrid = (
    <div className="flex-1 flex flex-col min-w-0 h-full">
        {navigationHeader}
        <ScrollArea className="flex-1">
            <div className="p-3.5 sm:p-4 pt-4 sm:pt-6">
                {searchQuery ? (
                    displayItems.length > 0 ? renderItemGrid(displayItems) : (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2">
                            <p className="font-semibold text-foreground">No products match &ldquo;{searchQuery}&rdquo;</p>
                            <p className="text-xs">Try searching for another name or clearing the filter.</p>
                            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-2 rounded-xl text-xs">
                                Clear Search
                            </Button>
                        </div>
                    )
                ) : viewMode === 'subcategory' && !selectedSubcategoryId ? (
                    renderSubcategoryGrid()
                ) : (
                    displayItems.length > 0 ? renderItemGrid(displayItems) : (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                            <p>No items found for this selection.</p>
                        </div>
                    )
                )}
            </div>
        </ScrollArea>
    </div>
  );

  const historyContent = (
    <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4 pt-4 pb-8">
            {recentSales && recentSales.length > 0 ? recentSales.map(sale => (
                <Collapsible key={sale.id}>
                    <div className="rounded-lg border bg-card/50 shadow-sm transition-colors hover:bg-accent/50 group">
                        <div className="flex items-center justify-between p-3">
                            <CollapsibleTrigger asChild>
                                <div className="flex-1 min-w-0 cursor-pointer">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-primary">{formatCurrency(sale.total, settings.currency)}</span>
                                        <span className="text-xs text-muted-foreground">• {format(sale.date.toDate(), 'p')}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                        {sale.items.reduce((acc, i) => acc + i.quantity, 0)} items • {format(sale.date.toDate(), 'PP')}
                                        <ChevronDown className="h-3 w-3 group-data-[state=open]:hidden" />
                                        <ChevronUp className="h-3 w-3 hidden group-data-[state=open]:block" />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-1 ml-2">
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8" 
                                    onClick={() => handlePrintReceipt(sale)}
                                    title="Print Receipt"
                                >
                                    <Printer className="h-4 w-4" />
                                </Button>
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" 
                                    onClick={() => setSaleToDelete(sale)}
                                    title="Delete Sale"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <CollapsibleContent className="px-3 pb-3 pt-0 border-t bg-muted/20">
                            <div className="space-y-1.5 mt-2">
                                {sale.items.map((si, idx) => {
                                    const itemName = items.find(i => i.id === si.itemId)?.name || 'Unknown Item';
                                    const itemGross = si.price * si.quantity;
                                    const itemDiscount = si.discount?.amount || 0;
                                    return (
                                        <div key={`${sale.id}-${idx}`} className="flex flex-col gap-0.5 text-[11px] leading-tight">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground font-medium">{si.quantity}x {itemName}</span>
                                                <span className={cn("font-semibold", itemDiscount > 0 && "text-muted-foreground line-through")}>
                                                    {formatCurrency(itemGross, settings.currency)}
                                                </span>
                                            </div>
                                            {itemDiscount > 0 && (
                                                <div className="flex justify-between text-destructive">
                                                    <span>Item Discount ({si.discount?.type === 'percent' ? `${si.discount.value}%` : 'Fixed'})</span>
                                                    <span>-{formatCurrency(itemDiscount, settings.currency)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                {sale.deliveryFee && (
                                    <div className="flex justify-between text-[11px] leading-tight text-primary pt-1">
                                        <span className="font-bold">Delivery Fee</span>
                                        <span className="font-bold">{formatCurrency(sale.deliveryFee, settings.currency)}</span>
                                    </div>
                                )}
                                {sale.discount && (
                                    <div className="flex justify-between text-[11px] leading-tight text-destructive pt-1 border-t border-destructive/10">
                                        <span className="font-bold">Overall Discount ({sale.discount.type === 'percent' ? `${sale.discount.value}%` : 'Fixed'})</span>
                                        <span className="font-bold">-{formatCurrency(sale.discount.amount, settings.currency)}</span>
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </div>
                </Collapsible>
            )) : (
                <div className="text-center py-10 text-muted-foreground">No recent sales found.</div>
            )}
        </div>
    </ScrollArea>
  );

  const checkoutControls = (
      <div className="space-y-4 bg-muted/5 border-t">
          <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3 w-3" /> Overall Discount
                  </Label>
                  {discountType !== 'none' && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setDiscountType('none'); setDiscountValue(0); }}
                      >
                          Remove
                      </Button>
                  )}
              </div>
              <div className="flex gap-2">
                  <div className="flex-1 flex p-1 bg-muted rounded-lg">
                      <Button 
                        type="button"
                        variant={discountType === 'percent' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="flex-1 h-8 rounded-md text-xs font-bold"
                        onClick={() => setDiscountType('percent')}
                      >
                          %
                      </Button>
                      <Button 
                        type="button"
                        variant={discountType === 'fixed' ? 'default' : 'ghost'} 
                        size="sm" 
                        className="flex-1 h-8 rounded-md text-xs font-bold"
                        onClick={() => setDiscountType('fixed')}
                      >
                          {formatCurrency(0, settings.currency).replace('0.00', '')}
                      </Button>
                  </div>
                  <div className="w-24">
                      <Input 
                        type="number" 
                        value={discountValue || ''} 
                        onChange={(e) => setDiscountValue(Number(e.target.value))} 
                        placeholder="0" 
                        className="h-10 text-center font-bold rounded-lg"
                        disabled={discountType === 'none'}
                      />
                  </div>
              </div>
          </div>

          <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" /> Delivery Fee
                  </Label>
                  <Switch 
                    checked={isDelivery} 
                    onCheckedChange={(checked) => {
                        setIsDelivery(checked);
                        if (!checked) setDeliveryFee(0);
                    }} 
                  />
              </div>
              {isDelivery && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                              {formatCurrency(0, settings.currency).replace('0.00', '')}
                          </span>
                          <Input 
                            type="number" 
                            value={deliveryFee || ''} 
                            onChange={(e) => setDeliveryFee(Number(e.target.value))} 
                            placeholder="0.00" 
                            className="pl-8 h-10 font-bold rounded-lg"
                          />
                      </div>
                  </div>
              )}
          </div>
      </div>
  );

  if (isMobile) {
    return (
        <div className="h-full flex flex-col bg-background">
            {itemGrid}
            <Sheet open={isCartOpen} onOpenChange={(open) => {
                setIsCartOpen(open);
                if (!open) forceInteractivity();
            }}>
                {cart.length > 0 && (
                    <SheetTrigger asChild>
                        <div className="bg-background border-t p-4 shadow-[0_-4px_15px_rgba(0,0,0,0.08)]">
                            <Button className="w-full text-lg h-12 shadow-lg rounded-xl">
                                <ShoppingCart className="mr-2 h-5 w-5"/>
                                View Cart ({cart.reduce((acc, item) => acc + item.quantity, 0)}) - {formatCurrency(cartTotal, settings.currency)}
                            </Button>
                        </div>
                    </SheetTrigger>
                )}
                <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 border-t rounded-t-2xl" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <SheetHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/10">
                        <div className="flex items-center gap-2">
                            <SheetTitle>Order Details</SheetTitle>
                            <Sheet open={isHistoryOpen} onOpenChange={(open) => {
                                setIsHistoryOpen(open);
                                if (!open) forceInteractivity();
                            }}>
                                <SheetTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><History className="h-4 w-4" /></Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="flex flex-col" onCloseAutoFocus={(e) => e.preventDefault()}>
                                    <SheetHeader>
                                        <SheetTitle>Recent Sales</SheetTitle>
                                        <SheetDescription>Transactions from the last 20 records.</SheetDescription>
                                    </SheetHeader>
                                    {historyContent}
                                </SheetContent>
                            </Sheet>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setIsCartOpen(false)}><X className="h-4 w-4" /></Button>
                    </SheetHeader>
                    
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="p-4 bg-muted/20 border-b shrink-0">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    type="button"
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal bg-background rounded-xl",
                                        !saleDate && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {saleDate ? format(saleDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="center">
                                    <Calendar
                                    mode="single"
                                    selected={saleDate}
                                    onSelect={(date) => date instanceof Date && setSaleDate(date)}
                                    disabled={(date: Date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <CartItemsList 
                                cart={cart} 
                                updateCartQuantity={updateCartQuantity} 
                                removeFromCart={removeFromCart} 
                                updateItemDiscount={updateItemDiscount}
                                settings={settings} 
                            />
                            {cart.length > 0 && checkoutControls}
                        </div>
                    </div>

                    <SheetFooter className="mt-auto flex-col gap-4 p-6 pt-6 border-t bg-background shrink-0">
                        <div className="space-y-4 w-full">
                            <div className="flex justify-between w-full text-xs text-muted-foreground px-1 pt-2.5">
                                <span>Gross Subtotal</span>
                                <span>{formatCurrency(cartSubtotal, settings.currency)}</span>
                            </div>
                            {cartSubtotal !== cartNetSubtotal && (
                                <div className="flex justify-between w-full text-xs text-destructive px-1">
                                    <span>Item-level Discounts</span>
                                    <span>-{formatCurrency(cartSubtotal - cartNetSubtotal, settings.currency)}</span>
                                </div>
                            )}
                            {discountType !== 'none' && (
                                <div className="flex justify-between w-full text-xs text-destructive font-medium px-1">
                                    <span>Overall Discount ({discountType === 'percent' ? `${discountValue}%` : 'Fixed'})</span>
                                    <span>-{formatCurrency(discountAmount, settings.currency)}</span>
                                </div>
                            )}
                            {isDelivery && (
                                <div className="flex justify-between w-full text-xs text-primary font-bold px-1">
                                    <span>Delivery Fee</span>
                                    <span>{formatCurrency(deliveryFee, settings.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-baseline w-full pt-5 mt-2 border-t border-dashed">
                                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                                <span className="text-3xl font-black text-primary tracking-tighter">
                                    {formatCurrency(cartTotal, settings.currency)}
                                </span>
                            </div>
                        </div>
                        <Button 
                            type="button"
                            size="lg" 
                            className="w-full text-lg font-bold h-12 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                            disabled={cart.length === 0 || isProcessing} 
                            onClick={handleCompleteSale}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "Complete Sale"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
            {!cart.length && (
                <div className="absolute bottom-6 right-6">
                    <Sheet open={isHistoryOpen} onOpenChange={(open) => {
                        setIsHistoryOpen(open);
                        if (!open) forceInteractivity();
                    }}>
                        <SheetTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full shadow-2xl bg-background border-primary/20">
                                <History className="h-6 w-6 text-primary" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="flex flex-col" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <SheetHeader>
                                <SheetTitle>Recent Sales</SheetTitle>
                                <SheetDescription>Transactions from the last 20 records.</SheetDescription>
                            </SheetHeader>
                            {historyContent}
                        </SheetContent>
                    </Sheet>
                </div>
            )}
            <AlertDialog open={!!saleToDelete} onOpenChange={(open) => {
                if (!open) {
                    setSaleToDelete(null);
                    forceInteractivity();
                }
            }}>
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete Transaction?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the sale record and restore the item quantities back to your inventory.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSale} disabled={isProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete and Restore"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh_-_theme(spacing.16))] bg-background overflow-hidden">
        {itemGrid}
        <div className="w-[400px] border-l bg-muted/5 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.03)] h-full overflow-hidden">
            <Card className="flex-1 flex flex-col rounded-none border-0 shadow-none bg-transparent overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-card py-4 shrink-0">
                    <CardTitle className="text-xl">Checkout</CardTitle>
                    <Sheet open={isHistoryOpen} onOpenChange={(open) => {
                        setIsHistoryOpen(open);
                        if (!open) forceInteractivity();
                    }}>
                        <SheetTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" title="View Recent Sales" className="rounded-full"><History className="h-5 w-5" /></Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="flex flex-col w-[450px]" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <SheetHeader>
                                <SheetTitle>Recent Sales</SheetTitle>
                                <SheetDescription>The last 20 transactions processed on this terminal.</SheetDescription>
                            </SheetHeader>
                            {historyContent}
                        </SheetContent>
                    </Sheet>
                </CardHeader>
                
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="p-4 border-b bg-muted/10 shrink-0">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                type="button"
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal bg-background rounded-xl h-11",
                                    !saleDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {saleDate ? format(saleDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={saleDate}
                                onSelect={(date) => date instanceof Date && setSaleDate(date)}
                                disabled={(date: Date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <CartItemsList 
                            cart={cart} 
                            updateCartQuantity={updateCartQuantity} 
                            removeFromCart={removeFromCart} 
                            updateItemDiscount={updateItemDiscount}
                            settings={settings} 
                        />
                        {cart.length > 0 && checkoutControls}
                    </div>
                </div>

                <CardFooter className="flex flex-col gap-4 px-6 py-6 pt-0 mt-auto bg-card shadow-[0_-10px_30px_rgba(0,0,0,0.03)] border-t shrink-0">
                    <div className="space-y-4 w-full">
                        <div className="flex justify-between w-full text-xs text-muted-foreground px-1 pt-2.5">
                            <span>Gross Subtotal</span>
                            <span>{formatCurrency(cartSubtotal, settings.currency)}</span>
                        </div>
                        {cartSubtotal !== cartNetSubtotal && (
                            <div className="flex justify-between w-full text-xs text-destructive px-1">
                                <span>Item Discounts</span>
                                <span>-{formatCurrency(cartSubtotal - cartNetSubtotal, settings.currency)}</span>
                            </div>
                        )}
                        {discountType !== 'none' && (
                            <div className="flex justify-between w-full text-xs text-destructive font-semibold px-1">
                                <span>Overall Discount ({discountType === 'percent' ? `${discountValue}%` : 'Fixed'})</span>
                                <span>-{formatCurrency(discountAmount, settings.currency)}</span>
                            </div>
                        )}
                        {isDelivery && (
                            <div className="flex justify-between w-full text-xs text-primary font-bold px-1">
                                <span>Delivery Fee</span>
                                <span>{formatCurrency(deliveryFee, settings.currency)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center w-full pt-5 mt-2 border-t border-dashed">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                            <span className="text-3xl font-black text-primary tracking-tighter">
                                {formatCurrency(cartTotal, settings.currency)}
                            </span>
                        </div>
                    </div>
                    <Button 
                        type="button"
                        size="lg" 
                        className="w-full text-md font-bold h-12 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-2"
                        disabled={cart.length === 0 || isProcessing} 
                        onClick={handleCompleteSale}
                    >
                        {isProcessing ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                        ) : (
                            "Complete Sale"
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <AlertDialog open={!!saleToDelete} onOpenChange={(open) => {
            if (!open) {
                setSaleToDelete(null);
                forceInteractivity();
            }
        }}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Delete Transaction?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the sale record and restore the item quantities back to your inventory.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSale} disabled={isProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete and Restore"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
