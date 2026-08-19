'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { itemSchema } from '@/schemas/itemSchema';
import { ItemWithId, CategoryWithId, SubcategoryWithId, StationWithId, Item, StockBatch, TaxWithId, Tax, StockReceipt } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { suggestItemDetails, SuggestItemDetailsInput } from '@/ai/flows/suggest-item-details';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDocs, writeBatch, collection, getDoc, updateDoc, query, where, documentId, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, PlusCircle, Sparkles, Trash2, Upload, X, ChevronsUpDown, Info } from 'lucide-react';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn, formatCurrency, forceInteractivity, roundTo } from '@/lib/utils';
import { SearchableSelect } from '../ui/searchable-select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useSettings } from '@/contexts/SettingsProvider';
import { StockBatchesViewer } from './StockBatchesViewer';
import { Badge } from '../ui/badge';
import { useAuth } from '../auth/AuthProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type ItemFormData = z.infer<typeof itemSchema>;

async function saveItemAction(
  firestore: any,
  storage: any,
  itemData: ItemFormData,
  id: string | null,
  currentUserId: string | undefined
): Promise<void> {
  const { initialQuantity, initialExpiryDate, initialPurchaseDate, initialRoastDate, ...restOfData } = itemData;

  let calculatedCost = 0;
  if (restOfData.inventoryType === 'simple') {
    const marketPrice = restOfData.marketPrice ?? 0;
    const purchaseQuantity = restOfData.purchaseQuantity ?? 0;
    
    let priceWithTaxes = marketPrice;
    if (restOfData.taxIds && restOfData.taxIds.length > 0) {
        const taxDocsPromises = restOfData.taxIds.map(id => getDoc(doc(firestore, 'taxes', id)));
        const taxDocsSnapshots = await Promise.all(taxDocsPromises);

        const selectedTaxes: Tax[] = [];
        taxDocsSnapshots.forEach(snap => {
            if (snap.exists()) {
                selectedTaxes.push(snap.data() as Tax);
            }
        });
        
        const additiveTaxes = selectedTaxes.filter(t => !t.taxType || t.taxType === 'additive');
        const compoundedTaxes = selectedTaxes.filter(t => t.taxType === 'compounded');

        const totalAdditiveRate = additiveTaxes.reduce((acc, tax) => acc + (tax.rate ?? 0), 0);
        priceWithTaxes = marketPrice * (1 + totalAdditiveRate / 100);

        compoundedTaxes.sort((a, b) => a.name.localeCompare(b.name));
        for (const tax of compoundedTaxes) {
            priceWithTaxes = priceWithTaxes * (1 + (tax.rate ?? 0) / 100);
        }
    }

    if (priceWithTaxes > 0 && purchaseQuantity > 0) {
      calculatedCost = priceWithTaxes / purchaseQuantity;
    }
  } else if (restOfData.inventoryType === 'composite') {
    if (Array.isArray(restOfData.components) && restOfData.components.length > 0) {
      const componentIds = restOfData.components.map(c => c.itemId);
      
      const chunkedIds: string[][] = [];
      for (let i = 0; i < componentIds.length; i += 30) {
        chunkedIds.push(componentIds.slice(i, i + 30));
      }

      const componentItemsMap = new Map<string, Item>();
      for (const ids of chunkedIds) {
        const q = query(collection(firestore, 'items'), where(documentId(), 'in', ids));
        const snap = await getDocs(q);
        snap.docs.forEach(doc => componentItemsMap.set(doc.id, doc.data() as Item));
      }

      const baseCost = restOfData.components.reduce((acc, comp) => {
        const componentItem = componentItemsMap.get(comp.itemId);
        return acc + (componentItem ? componentItem.cost * comp.quantity : 0);
      }, 0);

      let costWithTaxes = baseCost;
      if (restOfData.taxIds && restOfData.taxIds.length > 0) {
          const taxDocsPromises = restOfData.taxIds.map(id => getDoc(doc(firestore, 'taxes', id)));
          const taxDocsSnapshots = await Promise.all(taxDocsPromises);
  
          const selectedTaxes: Tax[] = [];
          taxDocsSnapshots.forEach(snap => {
              if (snap.exists()) {
                  selectedTaxes.push(snap.data() as Tax);
              }
          });
          
          const additiveTaxes = selectedTaxes.filter(t => !t.taxType || t.taxType === 'additive');
          const compoundedTaxes = selectedTaxes.filter(t => t.taxType === 'compounded');
  
          const totalAdditiveRate = additiveTaxes.reduce((acc, tax) => acc + (tax.rate ?? 0), 0);
          costWithTaxes = baseCost * (1 + totalAdditiveRate / 100);
          
          compoundedTaxes.sort((a, b) => a.name.localeCompare(b.name));
          for (const tax of compoundedTaxes) {
              costWithTaxes = costWithTaxes * (1 + (tax.rate ?? 0) / 100);
          }
      }
      
      const recipeYield = restOfData.yield || 1;
      calculatedCost = costWithTaxes / recipeYield;
    }
  }
  
  let existingItem: ItemWithId | null = null;
  if (id) {
    const docSnap = await getDoc(doc(firestore, 'items', id));
    if (docSnap.exists()) {
        existingItem = { id: docSnap.id, ...docSnap.data() } as ItemWithId;
    }
  }
  
  let finalImageUrl = existingItem?.imageUrl || '';
  const newImageUploaded = restOfData.imageUrl && restOfData.imageUrl.startsWith('data:');

  if (newImageUploaded) {
    if (existingItem?.imageUrl) {
      try {
        const oldFileRef = ref(storage, existingItem.imageUrl);
        await deleteObject(oldFileRef);
      } catch (e: any) {
      console.error(e); 
          if (e.code !== 'storage/object-not-found') {
            console.warn(`Could not delete old image: ${existingItem.imageUrl}`, e.message);
          }
      }
    }

    const uniqueId = id || doc(collection(firestore, 'items')).id;
    const fileName = `items/${uniqueId}-${Date.now()}`;
    const imageRef = ref(storage, fileName);
    await uploadString(imageRef, restOfData.imageUrl!, 'data_url');
    finalImageUrl = await getDownloadURL(imageRef);

  } else if (restOfData.imageUrl === null && existingItem?.imageUrl) {
    try {
      const oldFileRef = ref(storage, existingItem.imageUrl);
      await deleteObject(oldFileRef);
    } catch (e: any) {
      console.error(e); 
      if (e.code !== 'storage/object-not-found') {
        console.warn(`Could not delete old image: ${existingItem.imageUrl}`, e.message);
      }
    }
    finalImageUrl = '';
  }


  const dataForDb: Omit<Item, 'stockBatches'> = {
      name: restOfData.name,
      description: restOfData.description || '',
      categoryId: restOfData.categoryId,
      subcategoryId: restOfData.subcategoryId || null,
      stationId: restOfData.stationId || '',
      sku: restOfData.sku || '',
      barcode: restOfData.barcode || '',
      soldBy: restOfData.soldBy,
      price: restOfData.price ?? 0,
      cost: roundTo(calculatedCost),
      marketPrice: restOfData.marketPrice ?? 0,
      purchaseQuantity: restOfData.purchaseQuantity ?? 0,
      inventoryType: restOfData.inventoryType,
      trackStock: restOfData.trackStock,
      lowStockThreshold: restOfData.trackStock ? (restOfData.lowStockThreshold ?? 0) : 0,
      components: restOfData.inventoryType === 'composite' ? (restOfData.components || []) : [],
      yield: restOfData.inventoryType === 'composite' ? (restOfData.yield || 1) : undefined,
      tags: Array.isArray(restOfData.tags) ? restOfData.tags.map(tag => tag.value) : [],
      taxIds: restOfData.taxIds || [],
      posRepresentationType: restOfData.posRepresentationType || 'color',
      posColor: restOfData.posColor || '#cccccc',
      imageUrl: finalImageUrl,
      isSellable: restOfData.isSellable,
      saleType: restOfData.isSellable ? ((restOfData.saleType as 'dine-in' | 'take-away') || null) : null,
      itemType: restOfData.isSellable ? ((restOfData.itemType as 'food' | 'beverage' | 'packaging') || null) : null,
      beverageSize: (restOfData.isSellable && restOfData.itemType === 'beverage') ? (restOfData.beverageSize || null) : null,
      posShape: 'square'
  };

  if (id) {
    await updateDoc(doc(firestore, 'items', id), dataForDb);
  } else {
    const newDocRef = doc(collection(firestore, 'items'));
    const newBatches: StockBatch[] = [];
    const mainBatch = writeBatch(firestore);
    
    if (initialQuantity && initialQuantity > 0 && itemData.trackStock) {
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newBatch: StockBatch = {
          id: batchId,
          quantity: roundTo(initialQuantity),
          purchaseDate: initialPurchaseDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      };
      if (initialExpiryDate) newBatch.expiryDate = initialExpiryDate.toISOString().split('T')[0];
      if (initialRoastDate) newBatch.roastDate = initialRoastDate.toISOString().split('T')[0];
      
      newBatches.push(newBatch);

      const receiptRef = doc(collection(firestore, 'stockReceipts'));
      const receipt: Omit<StockReceipt, 'id'> = {
          date: Timestamp.fromDate(initialPurchaseDate || new Date()),
          userId: currentUserId || 'system',
          itemId: newDocRef.id,
          itemName: dataForDb.name,
          quantity: newBatch.quantity,
          unit: dataForDb.soldBy === 'volume' ? 'g/ml' : 'units',
          batchId: batchId,
          batchDetails: {
              date: initialExpiryDate?.toISOString().split('T')[0] || initialRoastDate?.toISOString().split('T')[0],
              dateType: initialExpiryDate ? 'expiry' : (initialRoastDate ? 'roast' : undefined),
          }
      };
      mainBatch.set(receiptRef, receipt);
    }
    mainBatch.set(newDocRef, { ...dataForDb, stockBatches: newBatches });
    await mainBatch.commit();
  }
}

interface ItemFormProps {
    item?: ItemWithId;
    categories: CategoryWithId[];
    stations: StationWithId[];
    simpleItems: ItemWithId[];
    taxes: TaxWithId[];
}

export function ItemForm({ item, categories, stations, simpleItems, taxes }: ItemFormProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isAiPending, startAiTransition] = useTransition();
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl || null);
  const [displayCost, setDisplayCost] = useState<number>(0);
  
  const isEditMode = !!item?.id;
  const storage = getStorage();

  const subcategoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subcategories'));
  }, [firestore]);
  const { data: allSubcategories } = useCollection<SubcategoryWithId>(subcategoriesQuery);

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: item
      ? {
          ...item,
          stationId: item.stationId || undefined,
          tags: item.tags?.map(t => ({ value: t })) || [],
          taxIds: item.taxIds || [],
          components: item.components || [],
          marketPrice: item.marketPrice ?? undefined,
          purchaseQuantity: item.purchaseQuantity ?? undefined,
          lowStockThreshold: item.lowStockThreshold ?? undefined,
          price: item.price ?? undefined,
          saleType: item.saleType ?? undefined,
          itemType: item.itemType ?? undefined,
          beverageSize: item.beverageSize ?? undefined,
          subcategoryId: item.subcategoryId || null,
          yield: item.yield ?? undefined,
        }
      : {
          name: '',
          description: '',
          categoryId: '',
          subcategoryId: null,
          stationId: undefined,
          sku: '',
          barcode: '',
          soldBy: 'each',
          price: undefined,
          marketPrice: undefined,
          purchaseQuantity: undefined,
          inventoryType: 'simple',
          trackStock: true,
          lowStockThreshold: 10,
          initialQuantity: undefined,
          initialPurchaseDate: new Date(),
          initialExpiryDate: undefined,
          initialRoastDate: undefined,
          components: [],
          yield: undefined,
          tags: [],
          taxIds: [],
          posRepresentationType: 'color',
          posColor: '#cccccc',
          imageUrl: undefined,
          isSellable: false,
          saleType: undefined,
          itemType: undefined,
          beverageSize: undefined,
        },
  });

  const { fields: componentFields, append: appendComponent, remove: removeComponent } = useFieldArray({
    control: form.control,
    name: 'components',
  });

  const { fields: tagFields, append: appendTag, remove: removeTag } = useFieldArray({
    control: form.control,
    name: 'tags',
  });
  
  const [tagInput, setTagInput] = useState('');
  const watchedTags = form.watch('tags');

  const inventoryType = form.watch('inventoryType');
  const isSellable = form.watch('isSellable');
  const trackStock = form.watch('trackStock');
  const itemType = form.watch('itemType');
  const categoryId = form.watch('categoryId');
  const soldBy = form.watch('soldBy');

  const filteredSubcategories = useMemo(() => {
    if (!allSubcategories || !categoryId) return [];
    return allSubcategories.filter(sub => sub.categoryId === categoryId);
  }, [allSubcategories, categoryId]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      const { marketPrice, purchaseQuantity, taxIds, inventoryType, components } = values;

      if (inventoryType === 'simple') {
        const price = marketPrice ?? 0;
        const quantity = purchaseQuantity ?? 0;
        const selectedTaxIds = taxIds ?? [];
        
        if (price > 0 && quantity > 0) {
            let priceWithTaxes = price;
            if (selectedTaxIds.length > 0) {
                const selectedTaxes = selectedTaxIds.map(id => taxes.find(t => t.id === id)).filter(Boolean) as TaxWithId[];
                const additiveTaxes = selectedTaxes.filter(t => !t.taxType || t.taxType === 'additive');
                const compoundedTaxes = selectedTaxes.filter(t => t.taxType === 'compounded');

                const totalAdditiveRate = additiveTaxes.reduce((acc, tax) => acc + (tax.rate ?? 0), 0);
                priceWithTaxes = price * (1 + totalAdditiveRate / 100);

                compoundedTaxes.sort((a, b) => a.name.localeCompare(b.name)); 
                for (const tax of compoundedTaxes) {
                    priceWithTaxes = priceWithTaxes * (1 + (tax.rate ?? 0) / 100);
                }
            }
            const newCost = priceWithTaxes / quantity;
            setDisplayCost(roundTo(newCost));
        } else {
            setDisplayCost(0);
        }
      } else if (inventoryType === 'composite') {
        const currentComponents = components || [];
        if (currentComponents.length > 0 && simpleItems.length > 0) {
            const componentItemsMap = new Map(simpleItems.map(doc => [doc.id, doc]));
            const baseCost = currentComponents.reduce((acc, comp) => {
                if (!comp || !comp.itemId || !comp.quantity) return acc;
                const componentItem = componentItemsMap.get(comp.itemId);
                return acc + ((componentItem?.cost ?? 0) * comp.quantity);
            }, 0);

            let costWithTaxes = baseCost;
            const selectedTaxIds = taxIds ?? [];
            if (selectedTaxIds.length > 0) {
                const selectedTaxes = selectedTaxIds.map(id => taxes.find(t => t.id === id)).filter(Boolean) as TaxWithId[];
                const additiveTaxes = selectedTaxes.filter(t => !t.taxType || t.taxType === 'additive');
                const compoundedTaxes = selectedTaxes.filter(t => t.taxType === 'compounded');

                const totalAdditiveRate = additiveTaxes.reduce((acc, tax) => acc + (tax.rate ?? 0), 0);
                costWithTaxes = baseCost * (1 + totalAdditiveRate / 100);

                compoundedTaxes.sort((a, b) => a.name.localeCompare(b.name));
                for (const tax of compoundedTaxes) {
                    costWithTaxes = costWithTaxes * (1 + (tax.rate ?? 0) / 100);
                }
            }
            setDisplayCost(roundTo(costWithTaxes));
        } else {
            setDisplayCost(0);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, taxes, simpleItems]);


  useEffect(() => {
    if (!isSellable) {
      form.setValue('saleType', undefined);
      form.setValue('itemType', undefined);
      form.setValue('beverageSize', undefined);
    }
  }, [isSellable, form]);

  useEffect(() => {
    if (inventoryType === 'simple') {
      form.setValue('components', []);
      form.setValue('yield', undefined);
      if (form.getValues('trackStock') === undefined) {
        form.setValue('trackStock', true);
      }
    } else if (inventoryType === 'composite') {
      form.setValue('trackStock', false);
      form.setValue('lowStockThreshold', undefined);
      form.setValue('initialQuantity', undefined);
      form.setValue('initialExpiryDate', undefined);
      form.setValue('initialRoastDate', undefined);
    }
  }, [inventoryType, form]);

  useEffect(() => {
    if (!trackStock) {
        form.setValue('lowStockThreshold', undefined);
    }
  }, [trackStock, form]);

  useEffect(() => {
    if (itemType !== 'beverage') {
      form.setValue('beverageSize', undefined);
    }
  }, [itemType, form]);

  useEffect(() => {
    if (!allSubcategories) return;

    const currentSubId = form.getValues('subcategoryId');
    if (currentSubId) {
      const isValid = filteredSubcategories.some(s => s.id === currentSubId);
      if (!isValid) {
        form.setValue('subcategoryId', null);
      }
    }
  }, [categoryId, filteredSubcategories, allSubcategories, form]);


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        form.setValue('imageUrl', result, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSuggestDetails = () => {
    const imageUrl = form.getValues('imageUrl');
    if (!imageUrl || !imageUrl.startsWith('data:')) {
        toast({ variant: 'destructive', title: 'Upload an Image First', description: 'You must upload a new product image to use the AI suggestion feature.' });
        return;
    }
    startAiTransition(async () => {
        try {
            const input: SuggestItemDetailsInput = { photoDataUri: imageUrl };
            const result = await suggestItemDetails(input);
            form.setValue('name', result.suggestedName, { shouldDirty: true });
            form.setValue('description', result.suggestedDescription, { shouldDirty: true });
            toast({ title: 'Suggestions Applied!', description: 'The AI has suggested a name and description for your item.' });
        } catch (error) {
      console.error(error);
            toast({ variant: 'destructive', title: 'AI Suggestion Failed', description: 'Could not generate suggestions. Please try again.' });
        }
    });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() !== '') {
      e.preventDefault();
      const currentTags = form.getValues('tags')?.map(t => t.value.toLowerCase()) || [];
      if (!currentTags.includes(tagInput.trim().toLowerCase())) {
        appendTag({ value: tagInput.trim() });
        setTagInput('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Duplicate Tag',
          description: 'This tag already exists.',
        });
      }
    }
  };

  const onSubmit = (data: ItemFormData) => {
    startTransition(async () => {
      try {
        await saveItemAction(firestore, storage, data, item?.id || null, appUser?.uid);
        toast({
          title: 'Success!',
          description: `Item ${isEditMode ? 'updated' : 'created'} successfully.`,
        });
        router.back();
        forceInteractivity();
      } catch (error) {
        console.error("Save item error:", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: (error as Error).message || 'Failed to save item.',
        });
      }
    });
  };

  const currentYield = form.watch('yield') || 1;
  const unitCost = displayCost / currentYield;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline font-bold tracking-tight">
              {isEditMode ? 'Edit Item' : 'Create New Item'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? `Editing ${item?.name}` : 'Fill out the details for your new inventory item.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Croissant" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="A short description of the item." {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subcategoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === 'none' ? null : val)} 
                          value={field.value || 'none'}
                          disabled={!categoryId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={categoryId ? "Select a subcategory" : "Select a category first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {filteredSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="stationId"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Station</FormLabel>
                        <Select 
                            onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)} 
                            defaultValue={field.value || 'none'}
                        >
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a station" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {stations.map((station) => (
                                    <SelectItem key={station.id} value={station.id}>{station.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Inventory</CardTitle>
                    <CardDescription>Manage stock, cost, and components.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField
                        control={form.control}
                        name="inventoryType"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel>Composite Item (Recipe)</FormLabel>
                                    <FormDescription>Made from other simple items in your inventory.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value === 'composite'}
                                        onCheckedChange={(checked) => field.onChange(checked ? 'composite' : 'simple')}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <div className={cn("space-y-6 pt-4 border-t", inventoryType !== 'simple' && 'hidden')}>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="marketPrice"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Purchase Price</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 18.50" {...field} value={field.value ?? ''} /></FormControl>
                                         <FormDescription>The price you pay for a pack/case.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="purchaseQuantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Units per Purchase</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 24" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormDescription>The number of individual units in the pack.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormItem>
                            <FormLabel>Unit Cost (Calculated)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="text" 
                                    readOnly 
                                    value={formatCurrency(displayCost, settings.currency)} 
                                    className="font-semibold bg-muted"
                                />
                            </FormControl>
                            <FormDescription>
                                The cost per unit based on purchase price, quantity, and taxes.
                            </FormDescription>
                        </FormItem>
                        <FormField
                            control={form.control}
                            name="trackStock"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel>Track Stock</FormLabel>
                                        <FormDescription>Enable automatic stock deduction upon sale.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className={cn("space-y-4 pl-4 border-l", !trackStock && 'hidden')}>
                            <FormField
                                control={form.control}
                                name="lowStockThreshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Low Stock Threshold</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormDescription>Get a notification when stock reaches this level.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {!isEditMode && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="initialQuantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Initial Stock Quantity</FormLabel>
                                                    <FormControl><Input type="number" placeholder="e.g., 50" {...field} value={field.value || ''} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="initialPurchaseDate"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Receive Date</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                type="button"
                                                                className={cn(
                                                                "pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="initialExpiryDate"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Initial Expiry Date</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                type="button"
                                                                className={cn(
                                                                "pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                                            control={form.control}
                                            name="initialRoastDate"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Initial Roast Date</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                type="button"
                                                                className={cn(
                                                                "pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                        </div>
                    </div>

                    <div className={cn("space-y-4 pt-4 border-t", inventoryType !== 'composite' && 'hidden')}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="space-y-1">
                                <h3 className="text-sm font-medium">Recipe Yield & Cost</h3>
                                <p className="text-[10px] text-muted-foreground">Define the total amount produced by this recipe batch.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-3 rounded-lg border">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Batch Cost</p>
                                    <p className="text-sm font-black">{formatCurrency(displayCost, settings.currency)}</p>
                                </div>
                                <div className="space-y-1 border-l pl-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unit Cost ({soldBy === 'volume' ? 'g/ml' : 'each'})</p>
                                    <p className="text-sm font-black text-primary">{formatCurrency(unitCost, settings.currency)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                            <FormField
                                control={form.control}
                                name="yield"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            Standard Recipe Yield
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground"/></TooltipTrigger>
                                                    <TooltipContent className="max-w-xs">
                                                        The total quantity produced (in g/ml or each) when making a full batch of this recipe.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder={soldBy === 'volume' ? "e.g., 1000" : "e.g., 1"} {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormDescription>Total yield in {soldBy === 'volume' ? 'g/ml' : 'units'}.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4 mt-6">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ingredients / Components</h4>
                            {componentFields.map((field, index) => {
                                const currentSelectedComponentIds = (form.watch('components') || []).map(c => c.itemId);
                                const currentComponentId = form.watch(`components.${index}.itemId`);
                                
                                const availableItemsForSelect = simpleItems.filter(
                                    item => !currentSelectedComponentIds.includes(item.id) || item.id === currentComponentId
                                );

                                return (
                                    <div key={field.id} className="flex items-end gap-2 p-2 border rounded-lg bg-card">
                                        <div className="grid grid-cols-2 gap-2 flex-1">
                                            <FormField
                                                control={form.control}
                                                name={`components.${index}.itemId`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Component Item</FormLabel>
                                                        <SearchableSelect
                                                            items={availableItemsForSelect}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select a component"
                                                            searchPlaceholder="Search simple items..."
                                                        />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`components.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Quantity Used</FormLabel>
                                                        <FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <Button type="button" variant="destructive" size="icon" className="h-10 w-10 shrink-0" onClick={() => removeComponent(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                            <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={() => appendComponent({ itemId: '', quantity: 1 })}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Ingredient
                            </Button>
                            <FormMessage>{form.formState.errors.components?.message}</FormMessage>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isEditMode && item?.stockBatches && (
              <StockBatchesViewer itemId={item.id} initialBatches={item.stockBatches} />
            )}

          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Identification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 4.50" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="taxIds"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Taxes</FormLabel>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" type="button" className="w-full justify-between font-normal text-left overflow-hidden">
                                        <span className="truncate">
                                            {field.value?.length 
                                                ? `${field.value.length} tax${field.value.length > 1 ? 'es' : ''} selected` 
                                                : "Select taxes"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[--radix-popover-trigger-width]">
                                    <DropdownMenuLabel>Apply taxes</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {taxes.map((tax) => (
                                    <DropdownMenuCheckboxItem
                                        key={tax.id}
                                        checked={field.value?.includes(tax.id)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), tax.id])
                                            : field.onChange(field.value?.filter((id) => id !== tax.id))
                                        }}
                                    >
                                        {tax.name} ({tax.rate}%)
                                    </DropdownMenuCheckboxItem>
                                    ))}
                                    {taxes.length === 0 && <DropdownMenuItem disabled>No taxes configured.</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <FormDescription>Select which taxes apply to this item.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="soldBy"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Sold By</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="each">Each (by unit)</SelectItem>
                                    <SelectItem value="volume">Volume (g/ml)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., C-BRD-001" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode (GTIN, UPC, etc.)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 123456789012" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                   <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add a tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (tagInput.trim() !== '') {
                          const currentTags = form.getValues('tags')?.map(t => t.value.toLowerCase()) || [];
                          if (!currentTags.includes(tagInput.trim().toLowerCase())) {
                            appendTag({ value: tagInput.trim() });
                            setTagInput('');
                          } else {
                            toast({
                              variant: 'destructive',
                              title: 'Duplicate Tag',
                              description: 'This tag already exists.',
                            });
                          }
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-2">
                    {tagFields.map((field, index) => (
                      <Badge key={field.id} variant="secondary" className="flex items-center gap-1.5 pl-2 pr-1 py-0.5">
                        {watchedTags?.[index]?.value}
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="rounded-full hover:bg-background/50 p-0.5"
                          aria-label={`Remove ${watchedTags?.[index]?.value} tag`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <FormDescription>
                    Add tags to group and search for items easily.
                  </FormDescription>
                </FormItem>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Point of Sale (POS)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                     <FormField
                        control={form.control}
                        name="isSellable"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel>Sellable Item</FormLabel>
                                    <FormDescription>Show this item on the sales terminal.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <div className={cn("space-y-4 pl-4 border-l", !isSellable && 'hidden')}>
                        <FormField
                            control={form.control}
                            name="saleType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sale Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select sale type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="dine-in">Dine In</SelectItem>
                                            <SelectItem value="take-away">Take Away</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="itemType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Item Type</FormLabel>
                                     <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="food">Food</SelectItem>
                                            <SelectItem value="beverage">Beverage</SelectItem>
                                            <SelectItem value="packaging">Packaging</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className={cn(itemType !== 'beverage' && 'hidden')}>
                            <FormField
                                control={form.control}
                                name="beverageSize"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Beverage Size</FormLabel>
                                        <FormControl><Input placeholder="e.g., 12oz, 355ml" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    <FormItem>
                        <FormLabel>Product Image</FormLabel>
                        <div className="flex items-center gap-4">
                            {imagePreview ? (
                                <div className="relative">
                                    <Image src={imagePreview} alt="Item preview" width={80} height={80} className="rounded-md object-cover" />
                                    <Button type="button" size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => { setImagePreview(null); form.setValue('imageUrl', null, { shouldDirty: true }); }}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ) : (
                                <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Button asChild variant="outline" type="button">
                                    <label htmlFor="image-upload" className="cursor-pointer">
                                        <Upload className="mr-2 h-4 w-4"/>
                                        Upload
                                        <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </Button>
                                 <Button type="button" variant="outline" size="sm" onClick={handleSuggestDetails} disabled={isAiPending}>
                                    {isAiPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                    Suggest
                                </Button>
                            </div>
                        </div>
                         <FormDescription>
                            Upload a new image or use the AI to generate a name/description.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                </CardContent>
            </Card>
          </div>
        </div>
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t -mx-8 -mb-8 px-8 z-10 flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()} type="button">
                Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>
      </form>
    </Form>
  );
}
