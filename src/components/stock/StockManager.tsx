
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import type { ItemWithId, StockBatch, CategoryWithId, WasteEvent, StockReceipt, StaffWithId } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Info, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn, roundTo } from '@/lib/utils';
import { calculateItemUnitCost } from '@/lib/calc';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '../ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import { useAuth as useAppAuth } from '@/components/auth/AuthProvider';

const receiveStockSchema = z.object({
  itemId: z.string().min(1, 'Please select an item.'),
  quantity: z.coerce.number().min(0.0001, 'Quantity must be positive.'),
  purchaseDate: z.date({ required_error: 'Please select a receive date.' }),
  dateType: z.enum(['expiry', 'roast', 'none']).default('none'),
  date: z.date().optional(),
  recordedByName: z.string().min(2, 'Please enter your name.'),
}).superRefine((data, ctx) => {
    if (data.dateType !== 'none' && !data.date) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${data.dateType === 'expiry' ? 'Expiry' : 'Roast'} date is required.`,
            path: ['date'],
        });
    }
});

const recordWasteSchema = z.object({
    itemId: z.string().min(1, 'Please select an item.'),
    batchId: z.string().optional(),
    quantity: z.coerce.number().min(0.0001, 'Quantity must be positive.'),
    reason: z.string().min(1, 'Please provide a specific reason.'),
    recordedByName: z.string().min(2, 'Please enter your name.'),
    eventType: z.enum(['waste', 'pull-out']).default('waste'),
});

interface StockManagerProps {
  initialItems: ItemWithId[];
  categories: CategoryWithId[];
  staff: StaffWithId[];
}

async function receiveStockAction(firestore: any, userId: string, itemId: string, newBatch: StockBatch, existingBatches: StockBatch[], item: ItemWithId, purchaseDate: Date, recordedByName: string) {
    const batch = writeBatch(firestore);

    // 1. Update item stock
    const itemRef = doc(firestore, 'items', itemId);
    batch.update(itemRef, { stockBatches: [...existingBatches, newBatch] });

    // 2. Create receipt log
    const receiptRef = doc(collection(firestore, 'stockReceipts'));

    const batchDetails: { date?: string; dateType?: 'expiry' | 'roast' } = {};
    if (newBatch.expiryDate) {
        batchDetails.date = newBatch.expiryDate;
        batchDetails.dateType = 'expiry';
    } else if (newBatch.roastDate) {
        batchDetails.date = newBatch.roastDate;
        batchDetails.dateType = 'roast';
    }

    const receipt: Omit<StockReceipt, 'id'> = {
        date: Timestamp.fromDate(purchaseDate),
        userId: userId,
        itemId: itemId,
        itemName: item.name,
        quantity: newBatch.quantity,
        unit: item.soldBy === 'volume' ? 'g/ml' : 'units',
        batchId: newBatch.id,
        batchDetails,
        recordedByName,
    };
    batch.set(receiptRef, receipt);

    await batch.commit();
}

async function recordWasteAction(firestore: any, updates: { itemId: string, stockBatches: StockBatch[] }[], wasteEvent: Omit<WasteEvent, 'id'>) {
    const batch = writeBatch(firestore);

    // 1. Update items stock
    for (const update of updates) {
        batch.update(doc(firestore, 'items', update.itemId), { stockBatches: update.stockBatches });
    }

    // 2. Create waste event
    const wasteEventRef = doc(collection(firestore, 'wasteEvents'));
    batch.set(wasteEventRef, { ...wasteEvent, date: Timestamp.fromDate(new Date(wasteEvent.date)) });
    
    await batch.commit();
}

function StockManager({ initialItems: items, categories, staff }: StockManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [receiveStockTypeFilter, setReceiveStockTypeFilter] = useState<'ingredient' | 'packaging'>('ingredient');
  const [wasteStockTypeFilter, setWasteStockTypeFilter] = useState<'ingredient' | 'packaging' | 'product'>('ingredient');
  const { toast } = useToast();
  const firestore = useFirestore();
  const { appUser } = useAppAuth();

  const receiveForm = useForm<z.infer<typeof receiveStockSchema>>({
    resolver: zodResolver(receiveStockSchema),
    defaultValues: { itemId: '', quantity: 0, dateType: 'none', purchaseDate: new Date(), recordedByName: '' },
  });
  
  const wasteForm = useForm<z.infer<typeof recordWasteSchema>>({
    resolver: zodResolver(recordWasteSchema),
    defaultValues: { itemId: '', batchId: '', quantity: 0, reason: '', recordedByName: '', eventType: 'waste' },
  });

  const packagingCategoryId = categories.find(c => c.name.toLowerCase() === 'packaging')?.id;
  const productCategoryId = categories.find(c => c.name.toLowerCase() === 'product' || c.name.toLowerCase() === 'products')?.id;
  
  const getFilteredItems = (filter: 'ingredient' | 'packaging' | 'product') => {
    return items.filter(item => {
      const isPackaging = item.categoryId === packagingCategoryId;
      const isProduct = item.categoryId === productCategoryId || item.isSellable;
      
      if (filter === 'packaging') return isPackaging;
      if (filter === 'product') return isProduct;
      return !isPackaging && !isProduct;
    });
  };

  const filteredReceiveItems = getFilteredItems(receiveStockTypeFilter as any);
  const filteredWasteItems = getFilteredItems(wasteStockTypeFilter);

  const handleReceiveFilterChange = (value: 'ingredient' | 'packaging') => {
    setReceiveStockTypeFilter(value);
    receiveForm.reset({ itemId: '', quantity: 0, dateType: value === 'packaging' ? 'none' : 'expiry', date: undefined, purchaseDate: new Date() });
  };
  
  const handleWasteFilterChange = (value: 'ingredient' | 'packaging' | 'product') => {
    setWasteStockTypeFilter(value);
    wasteForm.reset({ itemId: '', batchId: '', quantity: 0, reason: '', recordedByName: wasteForm.getValues('recordedByName'), eventType: wasteForm.getValues('eventType') });
  };

  const dateType = receiveForm.watch('dateType');

  function onReceiveSubmit(values: z.infer<typeof receiveStockSchema>) {
    startTransition(async () => {
      if (!appUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.' });
        return;
      }
      const item = items.find(i => i.id === values.itemId);
      if (!item) {
        toast({ variant: 'destructive', title: 'Error', description: 'Item not found.' });
        return;
      }

      const quantity = roundTo(values.quantity);

      const newBatch: StockBatch = {
        id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        quantity: quantity,
        purchaseDate: values.purchaseDate.toISOString().split('T')[0],
      };

      if (values.date && values.dateType !== 'none') {
        const isoDate = format(values.date, 'yyyy-MM-dd');
        if (values.dateType === 'expiry') {
            newBatch.expiryDate = isoDate;
        } else if (values.dateType === 'roast') {
            newBatch.roastDate = isoDate;
        }
      }

      try {
        await receiveStockAction(firestore, appUser.uid, item.id, newBatch, item.stockBatches, item, values.purchaseDate, values.recordedByName);
        toast({ title: 'Stock Added', description: `${quantity} ${item.soldBy === 'volume' ? 'g/ml' : 'units'} of ${item.name} recorded.` });
        receiveForm.reset({ itemId: '', quantity: 0, dateType: 'expiry', date: undefined, purchaseDate: new Date(), recordedByName: values.recordedByName });
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update stock.' });
      }
    });
  }
  
  const watchedWasteItemId = wasteForm.watch('itemId');
  const selectedWasteItem = items.find(i => i.id === watchedWasteItemId);
  const isCompositeWaste = selectedWasteItem?.inventoryType === 'composite';

  function onWasteSubmit(values: z.infer<typeof recordWasteSchema>) {
    startTransition(async () => {
        if (!appUser) {
          toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.' });
          return;
        }

        const item = items.find(i => i.id === values.itemId);
        if (!item) {
            toast({ variant: 'destructive', title: 'Error', description: 'Item not found.' });
            return;
        }

        const quantityToRemove = roundTo(values.quantity);
        const updates: Map<string, { itemId: string, stockBatches: StockBatch[] }> = new Map();

        if (item.inventoryType === 'simple') {
            if (!values.batchId) {
                wasteForm.setError('batchId', { message: 'Please select a batch.' });
                return;
            }
            const batch = item.stockBatches.find(b => b.id === values.batchId);
            if (!batch) {
                toast({ variant: 'destructive', title: 'Error', description: 'Stock batch not found.' });
                return;
            }
            if (quantityToRemove > batch.quantity) {
                wasteForm.setError('quantity', { message: `Cannot remove more than available in batch (${batch.quantity}).`});
                return;
            }

            const updatedBatches = item.stockBatches.map(b => 
                b.id === values.batchId ? { ...b, quantity: roundTo(b.quantity - quantityToRemove) } : b
            ).filter(b => b.quantity > 0);
            
            updates.set(item.id, { itemId: item.id, stockBatches: updatedBatches });

        } else if (item.inventoryType === 'composite') {
            // RECURSIVE INGREDIENT DEDUCTION
            const deductRecursive = (targetItem: ItemWithId, qty: number) => {
                if (targetItem.inventoryType === 'simple') {
                    if (!targetItem.trackStock) return;
                    
                    const updateObj = updates.get(targetItem.id) || { itemId: targetItem.id, stockBatches: structuredClone(targetItem.stockBatches || []) };
                    let remaining = roundTo(qty);
                    
                    // Sort by FIFO
                    updateObj.stockBatches.sort((a, b) => {
                        const dateA = a.expiryDate || a.purchaseDate || '9999-12-31';
                        const dateB = b.expiryDate || b.purchaseDate || '9999-12-31';
                        return dateA.localeCompare(dateB);
                    });

                    for (const b of updateObj.stockBatches) {
                        if (remaining <= 0) break;
                        const deduct = Math.min(b.quantity, remaining);
                        b.quantity = roundTo(b.quantity - deduct);
                        remaining = roundTo(remaining - deduct);
                    }
                    
                    updateObj.stockBatches = updateObj.stockBatches.filter(b => b.quantity > 0);
                    updates.set(targetItem.id, updateObj);

                    if (remaining > 0) {
                        console.warn(`Insufficient stock for ${targetItem.name} during composite waste. Shortage: ${remaining}`);
                    }

                } else if (targetItem.inventoryType === 'composite') {
                    for (const comp of (targetItem.components || [])) {
                        const compItem = items.find(i => i.id === comp.itemId);
                        if (compItem) deductRecursive(compItem, comp.quantity * qty);
                    }
                }
            };

            deductRecursive(item, quantityToRemove);
        }

        const wasteEvent: Omit<WasteEvent, 'id'> = {
            date: new Date().toISOString(),
            itemId: item.id,
            itemName: item.name,
            quantity: quantityToRemove,
            cost: roundTo(calculateItemUnitCost(item, new Map(items.map(i => [i.id, i]))) * quantityToRemove),
            unit: item.soldBy === 'volume' ? 'g/ml' : 'units',
            userId: appUser.uid,
            recordedByName: values.recordedByName,
            reason: values.reason,
            eventType: values.eventType,
            ...(values.batchId ? { batchId: values.batchId } : {}),
        };

        try {
            await recordWasteAction(firestore, Array.from(updates.values()), wasteEvent);
            toast({ title: 'Reduction Recorded', description: `${quantityToRemove} ${wasteEvent.unit} of ${item.name} removed. Inventory updated.`});
            wasteForm.reset({ 
                itemId: '', 
                batchId: '', 
                quantity: 0, 
                reason: '', 
                recordedByName: values.recordedByName,
                eventType: values.eventType
            });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record reduction event.' });
        }
    });
  }
  
  const getBatchLabel = (batch: StockBatch) => {
    let label = `Qty: ${batch.quantity}`;
    if (batch.expiryDate) {
        label += ` (Expires: ${format(new Date(batch.expiryDate), 'MMM d, yyyy')})`;
    } else if (batch.roastDate) {
        label += ` (Roasted: ${format(new Date(batch.roastDate), 'MMM d, yyyy')})`;
    }
    return label;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Tabs defaultValue="receive" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receive">Receive Stock</TabsTrigger>
          <TabsTrigger value="waste">Record Waste / Pull Out</TabsTrigger>
        </TabsList>
        <TabsContent value="receive">
          <Card>
            <CardHeader>
              <CardTitle>Receive New Stock</CardTitle>
              <CardDescription>Add new inventory for your ingredients and packaging.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...receiveForm}>
                <form onSubmit={receiveForm.handleSubmit(onReceiveSubmit)} className="space-y-6">
                  <RadioGroup
                    defaultValue={receiveStockTypeFilter}
                    onValueChange={handleReceiveFilterChange as (value: string) => void}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ingredient" id="ingredient" />
                        <Label htmlFor="ingredient">Ingredient</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="packaging" id="packaging" />
                        <Label htmlFor="packaging">Packaging</Label>
                    </div>
                  </RadioGroup>
                  <FormField
                    control={receiveForm.control}
                    name="itemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            items={filteredReceiveItems}
                            placeholder={`Select an ${receiveStockTypeFilter}`}
                            searchPlaceholder={`Search ${receiveStockTypeFilter}s...`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={receiveForm.control}
                        name="purchaseDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Receive Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={receiveForm.control}
                        name="quantity"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.0001" placeholder="0.00" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>

                  {receiveStockTypeFilter === 'ingredient' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <FormField
                        control={receiveForm.control}
                        name="dateType"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Shelf Life Info</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-wrap gap-4"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="expiry" /></FormControl>
                                    <Label className="font-normal text-xs">Expiry</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="roast" /></FormControl>
                                    <Label className="font-normal text-xs">Roast</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="none" /></FormControl>
                                    <Label className="font-normal text-xs">None</Label>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <div className={cn(dateType === 'none' && 'hidden')}>
                        <FormField
                            control={receiveForm.control}
                            name="date"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-xs">{dateType === 'expiry' ? 'Expiry Date' : 'Roast Date'}</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        </div>
                    </div>
                  )}
                  
                  <FormField
                    control={receiveForm.control}
                    name="recordedByName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recorded By</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select staff member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {staff.map(s => (
                              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Stock
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="waste">
          <Card>
            <CardHeader>
                <CardTitle>Record Waste or Pull Out</CardTitle>
                <CardDescription>Remove stock from inventory due to spoilage, damage, or intentional removal.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...wasteForm}>
                    <form onSubmit={wasteForm.handleSubmit(onWasteSubmit)} className="space-y-6">
                        <div className="flex flex-col sm:flex-row gap-6 pb-4 border-b">
                            <FormField
                                control={wasteForm.control}
                                name="eventType"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Reduction Type</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="waste" id="type-waste" />
                                                    <Label htmlFor="type-waste" className="font-semibold text-destructive">Waste</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="pull-out" id="type-pull-out" />
                                                    <Label htmlFor="type-pull-out" className="font-semibold text-primary">Pull Out</Label>
                                                </div>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex-1 space-y-3">
                                <Label>Item Category</Label>
                                <RadioGroup
                                    defaultValue={wasteStockTypeFilter}
                                    onValueChange={handleWasteFilterChange as (value: string) => void}
                                    className="flex flex-wrap gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="ingredient" id="waste-ingredient" />
                                        <Label htmlFor="waste-ingredient">Ingredient</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="packaging" id="waste-packaging" />
                                        <Label htmlFor="waste-packaging">Packaging</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="product" id="waste-product" />
                                        <Label htmlFor="waste-product">Product</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        <FormField
                            control={wasteForm.control}
                            name="itemId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Item</FormLabel>
                                    <FormControl>
                                        <SearchableSelect
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            items={filteredWasteItems}
                                            placeholder={`Select an item to remove`}
                                            searchPlaceholder={`Search ${wasteStockTypeFilter}s...`}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {!isCompositeWaste ? (
                            <FormField
                                control={wasteForm.control}
                                name="batchId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Stock Batch</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedWasteItem || !selectedWasteItem.stockBatches || selectedWasteItem.stockBatches.length === 0}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Select a batch" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {selectedWasteItem && selectedWasteItem.stockBatches.length > 0 ? selectedWasteItem.stockBatches.map(batch => (
                                                <SelectItem key={batch.id} value={batch.id}>
                                                    {getBatchLabel(batch)}
                                                </SelectItem>
                                            )) : (
                                                <SelectItem value="no-stock" disabled>No stock available</SelectItem>
                                            )}
                                        </SelectContent>
                                        </Select>
                                        <FormDescription>Select the specific batch to remove stock from.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                                <div className="flex items-center gap-2 text-primary">
                                    <Info className="h-4 w-4" />
                                    <p className="text-xs font-bold uppercase tracking-wider">Composite Recipe Waste</p>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This is a premade item. Wasting <span className="font-bold text-foreground">{wasteForm.watch('quantity') || 0} {selectedWasteItem?.soldBy === 'volume' ? 'g/ml' : 'units'}</span> will proportionally deduct the following ingredients from your stock:
                                </p>
                                <div className="grid grid-cols-1 gap-1 pl-6">
                                    {selectedWasteItem?.components?.map(c => {
                                        const compItem = items.find(i => i.id === c.itemId);
                                        const wastedAmt = roundTo(c.quantity * (wasteForm.watch('quantity') || 0));
                                        return (
                                            <div key={c.itemId} className="flex items-center gap-2 text-[11px]">
                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium text-foreground">{compItem?.name || 'Unknown'}:</span>
                                                <span className="text-primary font-bold">{wastedAmt} {compItem?.soldBy === 'volume' ? 'g/ml' : 'units'}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={wasteForm.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Quantity to Remove</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.0001" placeholder="0.00" {...field} value={field.value || ''} disabled={!watchedWasteItemId} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={wasteForm.control}
                                name="recordedByName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Recorded By</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!watchedWasteItemId}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Select staff member" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {staff.map(s => (
                                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={wasteForm.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Reason (Required)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Explain why this item is being removed." {...field} disabled={!watchedWasteItemId} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                         <Button type="submit" className="w-full" disabled={isPending || !watchedWasteItemId}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Reduction
                        </Button>
                    </form>
                </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default StockManager;
