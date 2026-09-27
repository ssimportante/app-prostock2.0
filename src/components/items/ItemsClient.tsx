'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ItemWithId, CategoryWithId, StationWithId, Item, SubcategoryWithId, SaleWithId, StockReceiptWithId, WasteEvent } from '@/types';
import { getColumns } from './columns';
import { DataTable } from './data-table';
import { ItemsToolbar } from './ItemsToolbar';
import {
  type ColumnFiltersState,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type RowSelectionState,
  type PaginationState,
  type Updater,
} from '@tanstack/react-table';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, PlusCircle, X, Layers, Layout, MapPin, Search } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch, doc, query, where, documentId, getDoc } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from "firebase/storage";
import { Skeleton } from '../ui/skeleton';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from '@/components/ui/command';
import { cn, forceInteractivity } from '@/lib/utils';
import { importItems } from '@/lib/import-items';
import { Badge } from '../ui/badge';
import { useSettings } from '@/contexts/SettingsProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

async function deleteItemsAction(firestore: any, storage: any, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;
    const batch = writeBatch(firestore);
    for (const id of itemIds) {
        const itemRef = doc(firestore, 'items', id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
            const item = itemSnap.data() as Item;
            if (item.imageUrl) {
                try {
                    const imageRef = ref(storage, item.imageUrl);
                    await deleteObject(imageRef).catch((error) => {
                        if (error.code !== 'storage/object-not-found') throw error;
                    });
                } catch(e) {
      console.error(e);
                    console.warn(`Failed to delete image for item ${id}:`, e);
                }
            }
        }
        batch.delete(itemRef);
    }
    await batch.commit();
}

async function bulkUpdateItemsAction(firestore: any, itemIds: string[], data: Partial<Item>) {
    if (!itemIds.length) return;
    const chunkedIds: string[][] = [];
    for (let i = 0; i < itemIds.length; i += 30) chunkedIds.push(itemIds.slice(i, i + 30));
    for (const chunk of chunkedIds) {
        const batch = writeBatch(firestore);
        const itemsQuery = query(collection(firestore, 'items'), where(documentId(), 'in', chunk));
        const querySnapshot = await getDocs(itemsQuery);
        querySnapshot.forEach(docSnap => {
            batch.update(docSnap.ref, data);
        });
        await batch.commit();
    }
}

async function addTagsToItemsAction(firestore: any, itemIds: string[], tags: string[]) {
    if (!itemIds.length || !tags.length) return;
    const chunkedIds: string[][] = [];
    for (let i = 0; i < itemIds.length; i += 30) chunkedIds.push(itemIds.slice(i, i + 30));
    for (const chunk of chunkedIds) {
        const batch = writeBatch(firestore);
        const itemsQuery = query(collection(firestore, 'items'), where(documentId(), 'in', chunk));
        const querySnapshot = await getDocs(itemsQuery);
        querySnapshot.forEach(docSnap => {
            const item = docSnap.data() as Item;
            const currentTags = item.tags || [];
            const newTags = [...currentTags];
            tags.forEach(tag => {
                if (!newTags.includes(tag)) newTags.push(tag);
            });
            if (newTags.length !== currentTags.length) {
                batch.update(docSnap.ref, { tags: newTags });
            }
        });
        await batch.commit();
    }
}

async function removeTagsFromItemsAction(firestore: any, itemIds: string[], tags: string[]) {
    if (!itemIds.length || !tags.length) return;
    const chunkedIds: string[][] = [];
    for (let i = 0; i < itemIds.length; i += 30) chunkedIds.push(itemIds.slice(i, i + 30));
    for (const chunk of chunkedIds) {
        const batch = writeBatch(firestore);
        const itemsQuery = query(collection(firestore, 'items'), where(documentId(), 'in', chunk));
        const querySnapshot = await getDocs(itemsQuery);
        querySnapshot.forEach(docSnap => {
            const item = docSnap.data() as Item;
            const currentTags = item.tags || [];
            const updatedTags = currentTags.filter(t => !tags.includes(t));
            if (updatedTags.length !== currentTags.length) {
                batch.update(docSnap.ref, { tags: updatedTags });
            }
        });
        await batch.commit();
    }
}

interface ItemsClientProps {
  items: ItemWithId[];
  categories: CategoryWithId[];
  subcategories: SubcategoryWithId[];
  stations: StationWithId[];
  sales: SaleWithId[];
  receipts: StockReceiptWithId[];
  wasteEvents: WasteEvent[];
  isLoading: boolean;
}

export default function ItemsClient({
  items,
  categories,
  subcategories,
  stations,
  sales,
  receipts,
  wasteEvents,
  isLoading: isLoadingFromHook,
}: ItemsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = getStorage();

  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isBulkUpdateDialogOpen, setIsBulkUpdateDialogOpen] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState<'categoryId' | 'subcategoryId' | 'stationId' | null>(null);
  const [bulkUpdateValue, setBulkUpdateValue] = useState<string>("");
  const [whereUsedItem, setWhereUsedItem] = useState<ItemWithId | null>(null);
  
  const [tagsToAction, setTagsToAction] = useState<string[]>([]);
  const [currentTagActionType, setCurrentTagActionType] = useState<'add-tag' | 'remove-tag' | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [isActionPending, startActionTransition] = useTransition();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isImporting, setIsImporting] = useState(false);

  // DERIVE TABLE STATE FROM URL
  const columnFilters = useMemo((): ColumnFiltersState => {
    const filters: ColumnFiltersState = [];
    
    // Explicitly parse string filters
    const q = searchParams.get('name')?.trim();
    if (q) filters.push({ id: 'name', value: q });
    
    // Parse list filters using filter(Boolean) to ignore empty segments
    const catIds = searchParams.get('categoryId')?.split(',').filter(Boolean);
    if (catIds?.length) filters.push({ id: 'categoryId', value: catIds });

    const subIds = searchParams.get('subcategoryId')?.split(',').filter(Boolean);
    if (subIds?.length) filters.push({ id: 'subcategoryId', value: subIds });

    const statIds = searchParams.get('stationId')?.split(',').filter(Boolean);
    if (statIds?.length) filters.push({ id: 'stationId', value: statIds });

    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    if (tags?.length) filters.push({ id: 'tags', value: tags });

    return filters;
  }, [searchParams]);

  const sorting = useMemo((): SortingState => {
    const sort = searchParams.get('sort');
    const order = searchParams.get('order');
    return sort ? [{ id: sort, desc: order === 'desc' }] : [];
  }, [searchParams]);

  const pagination = useMemo((): PaginationState => ({
    pageIndex: Math.max(0, Number(searchParams.get('page')) - 1 || 0),
    pageSize: Number(searchParams.get('pageSize')) || 10,
  }), [searchParams]);

  const asOfStr = searchParams.get('asOf');
  const asOfDate = useMemo(() => asOfStr ? new Date(asOfStr) : null, [asOfStr]);

  // Reactive transformation: Force table update when asOf filter changes by returning new object references
  const tableData = useMemo(() => {
    return items.map(item => ({ ...item }));
  }, [items, asOfStr]);

  const updateUrl = useCallback((updates: Record<string, string | string[] | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === '') {
        params.delete(key);
      } else if (Array.isArray(value)) {
        const filteredValue = value.filter(Boolean);
        if (filteredValue.length > 0) {
            params.set(key, filteredValue.join(','));
        } else {
            params.delete(key);
        }
      } else {
        params.set(key, String(value));
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  const onColumnFiltersChange = useCallback((updater: Updater<ColumnFiltersState>) => {
    const nextFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
    const updates: Record<string, any> = { 
        name: null, categoryId: null, subcategoryId: null, stationId: null, tags: null, page: 1 
    };
    nextFilters.forEach(f => { 
        if (f.value !== undefined && f.value !== null && f.value !== '') {
            updates[f.id] = f.value; 
        }
    });
    updateUrl(updates);
  }, [columnFilters, updateUrl]);

  const onSortingChange = useCallback((updater: Updater<SortingState>) => {
    const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
    if (nextSorting.length > 0) {
        updateUrl({ sort: nextSorting[0].id, order: nextSorting[0].desc ? 'desc' : 'asc' });
    } else {
        updateUrl({ sort: null, order: null });
    }
  }, [sorting, updateUrl]);

  const onPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    const nextPagination = typeof updater === 'function' ? updater(pagination) : updater;
    updateUrl({ page: nextPagination.pageIndex + 1, pageSize: nextPagination.pageSize });
  }, [pagination, updateUrl]);

  const handleAsOfDateChange = useCallback((date: Date | null) => {
    updateUrl({ asOf: date ? format(date, 'yyyy-MM-dd') : null, page: 1 });
  }, [updateUrl]);

  // Global interactivity guard
  useEffect(() => {
    const active = itemsToDelete.length > 0 || isTagDialogOpen || isBulkUpdateDialogOpen || !!whereUsedItem;
    if (!active) {
        forceInteractivity();
    }
  }, [itemsToDelete, isTagDialogOpen, isBulkUpdateDialogOpen, whereUsedItem]);

  const uniqueTags = useMemo(() => {
    const allTags = items.flatMap(item => item.tags || []);
    return [...new Set(allTags)].sort();
  }, [items]);

  const onEdit = useCallback((id: string) => {
    router.push(`/items/${id}/edit`);
  }, [router]);

  const onDuplicate = useCallback((id: string) => {
    router.push(`/items/new?duplicate=${id}`);
  }, [router]);

  const onDelete = useCallback((id: string) => {
    setItemsToDelete([id]);
  }, []);

  const onWhereUsed = useCallback((item: ItemWithId) => {
    setWhereUsedItem(item);
  }, []);

  const columns = useMemo(
    () => getColumns(categories, subcategories, stations, onEdit, onDuplicate, onDelete, onWhereUsed, asOfStr, settings.currency, items, sales, receipts, wasteEvents),
    [categories, subcategories, stations, onEdit, onDuplicate, onDelete, onWhereUsed, asOfStr, settings.currency, items, sales, receipts, wasteEvents]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, columnFilters, rowSelection, pagination },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange,
    onColumnFiltersChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
  });

  const handleImport = async (data: any[]) => {
    if (data.length === 0) return;
    setIsImporting(true);
    try {
      const result = await importItems(firestore, data);
      const parts = [`${result.created} items imported`];
      if (result.categoriesCreated > 0) parts.push(`${result.categoriesCreated} categories created`);
      if (result.subcategoriesCreated > 0) parts.push(`${result.subcategoriesCreated} subcategories created`);
      toast({ title: 'Import Complete', description: parts.join(', ') + '.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to import items.' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteItems = async () => {
    if (itemsToDelete.length === 0) return;
    startDeleteTransition(async () => {
      try {
        await deleteItemsAction(firestore, storage, itemsToDelete);
        toast({ title: 'Success', description: `${itemsToDelete.length} item(s) deleted.` });
      } catch (error) {
      console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete item(s).' });
      } finally {
        setItemsToDelete([]);
        setRowSelection({});
        forceInteractivity();
      }
    });
  };

  const handleTagActionDialog = (actionType: 'add-tag' | 'remove-tag') => {
      const selectedIds = table.getSelectedRowModel().flatRows.map(row => row.original.id);
      if (selectedIds.length === 0) {
        toast({ variant: 'destructive', title: 'No items selected' });
        return;
      }
      setCurrentTagActionType(actionType);
      setIsTagDialogOpen(true);
  }

  const handleConfirmTagAction = () => {
    if (!currentTagActionType || tagsToAction.length === 0) return;
    startActionTransition(async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(row => row.original.id);
        try {
            if (currentTagActionType === 'add-tag') {
                await addTagsToItemsAction(firestore, selectedIds, tagsToAction);
                toast({ title: 'Success', description: `${tagsToAction.length} tag(s) added to ${selectedIds.length} item(s).` });
            } else {
                await removeTagsFromItemsAction(firestore, selectedIds, tagsToAction);
                toast({ title: 'Success', description: `${tagsToAction.length} tag(s) removed from ${selectedIds.length} item(s).` });
            }
        } catch (error) {
      console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update tags.' });
        } finally {
            setIsTagDialogOpen(false);
            setTagsToAction([]);
            setCurrentTagActionType(null);
            setRowSelection({});
            forceInteractivity();
        }
    });
  };

  const handleBulkUpdateDialog = (field: 'categoryId' | 'subcategoryId' | 'stationId') => {
      const selectedIds = table.getSelectedRowModel().flatRows.map(row => row.original.id);
      if (selectedIds.length === 0) {
          toast({ variant: 'destructive', title: 'No items selected' });
          return;
      }
      setBulkUpdateField(field);
      setBulkUpdateValue("");
      setIsBulkUpdateDialogOpen(true);
  };

  const handleConfirmBulkUpdate = () => {
      if (!bulkUpdateField || !bulkUpdateValue) return;
      startActionTransition(async () => {
          const selectedIds = table.getSelectedRowModel().flatRows.map(row => row.original.id);
          try {
              const updateData: Partial<Item> = { [bulkUpdateField]: bulkUpdateValue === 'none' ? null : bulkUpdateValue };
              await bulkUpdateItemsAction(firestore, selectedIds, updateData);
              toast({ title: 'Success', description: `${selectedIds.length} item(s) updated.` });
          } catch (error) {
      console.error(error);
              toast({ variant: 'destructive', title: 'Error', description: 'Failed to bulk update items.' });
          } finally {
              setIsBulkUpdateDialogOpen(false);
              setBulkUpdateField(null);
              setBulkUpdateValue("");
              setRowSelection({});
              forceInteractivity();
          }
      });
  };

  const toggleTagSelection = (tag: string) => {
    setTagsToAction(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const isDataLoading = isLoadingFromHook && items.length === 0;
  const filteredTags = uniqueTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()));
  const isNewTag = tagSearch && !uniqueTags.some(tag => tag.toLowerCase() === tagSearch.toLowerCase());

  const itemsUsingSelected = useMemo(() => {
    if (!whereUsedItem) return [];
    return items.filter(item => 
        item.inventoryType === 'composite' && 
        item.components?.some(c => c.itemId === whereUsedItem.id)
    );
  }, [items, whereUsedItem]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-headline font-bold tracking-tight">Inventory Items</h1>
      <p className="text-muted-foreground">Manage your products and ingredients.</p>
      
      <ItemsToolbar
        table={table}
        categories={categories}
        subcategories={subcategories}
        stations={stations}
        items={items}
        onImport={handleImport}
        isImporting={isImporting}
        onAddTag={() => handleTagActionDialog('add-tag')}
        onRemoveTag={() => handleTagActionDialog('remove-tag')}
        onUpdateField={(field) => handleBulkUpdateDialog(field as any)}
        onDeleteSelected={() => setItemsToDelete(table.getSelectedRowModel().flatRows.map(r => r.original.id))}
        asOfDate={asOfDate}
        onAsOfDateChange={handleAsOfDateChange}
      />

      {isDataLoading ? (
        <div className="mt-4 space-y-4">
          <Skeleton className="h-12 w-full" /><Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="mt-4"><DataTable table={table} columns={columns} /></div>
      )}

      <AlertDialog open={itemsToDelete.length > 0} onOpenChange={(open) => {
          if (!open) {
              setItemsToDelete([]);
              forceInteractivity();
          }
      }}>
        <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete {itemsToDelete.length} item(s).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItems} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isTagDialogOpen} onOpenChange={(open) => {
          if (!open) {
              setIsTagDialogOpen(false);
              setTagsToAction([]);
              setTagSearch('');
              forceInteractivity();
          }
      }}>
        <DialogContent className="sm:max-w-[425px]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>{currentTagActionType === 'add-tag' ? 'Add Tags' : 'Remove Tags'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Command className="rounded-lg border">
                    <CommandInput placeholder="Search tags..." value={tagSearch} onValueChange={setTagSearch} />
                    <CommandList>
                        <CommandEmpty>{isNewTag ? `Press Enter to create "${tagSearch}"` : 'No tag found.'}</CommandEmpty>
                        <CommandGroup>
                            {isNewTag && (
                                <CommandItem onSelect={() => { 
                                    if (!tagsToAction.includes(tagSearch)) {
                                        setTagsToAction(prev => [...prev, tagSearch]);
                                    }
                                    setTagSearch(''); 
                                }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create "{tagSearch}"
                                </CommandItem>
                            )}
                            {filteredTags.map((tag) => (
                                <CommandItem key={tag} onSelect={() => toggleTagSelection(tag)}>
                                    <Check className={cn("mr-2 h-4 w-4", tagsToAction.includes(tag) ? "opacity-100" : "opacity-0")} /> {tag}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
                <div className="space-y-2">
                    <p className="text-sm font-medium">Selected tags:</p>
                    <div className="flex flex-wrap gap-1.5 min-h-[2rem] p-2 rounded-md bg-muted/50 border border-dashed">
                        {tagsToAction.length > 0 ? tagsToAction.map(tag => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                {tag}
                                <X 
                                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                    onClick={() => toggleTagSelection(tag)} 
                                />
                            </Badge>
                        )) : (
                            <p className="text-xs text-muted-foreground italic">None selected</p>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsTagDialogOpen(false)} disabled={isActionPending}>Cancel</Button>
                <Button onClick={handleConfirmTagAction} disabled={tagsToAction.length === 0 || isActionPending}>
                    {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkUpdateDialogOpen} onOpenChange={(open) => {
          if (!open) {
              setIsBulkUpdateDialogOpen(false);
              setBulkUpdateField(null);
              setBulkUpdateValue("");
              forceInteractivity();
          }
      }}>
          <DialogContent className="sm:max-w-[425px]" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      {bulkUpdateField === 'categoryId' && <Layers className="h-5 w-5" />}
                      {bulkUpdateField === 'subcategoryId' && <Layout className="h-5 w-5" />}
                      {bulkUpdateField === 'stationId' && <MapPin className="h-5 w-5" />}
                      Update {bulkUpdateField === 'categoryId' ? 'Category' : bulkUpdateField === 'subcategoryId' ? 'Subcategory' : 'Station'}
                  </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                      Setting a new {bulkUpdateField === 'categoryId' ? 'category' : bulkUpdateField === 'subcategoryId' ? 'subcategory' : 'station'} for {table.getSelectedRowModel().flatRows.length} selected item(s).
                  </p>
                  <Select value={bulkUpdateValue} onValueChange={setBulkUpdateValue}>
                      <SelectTrigger>
                          <SelectValue placeholder={`Select ${bulkUpdateField === 'categoryId' ? 'category' : bulkUpdateField === 'subcategoryId' ? 'subcategory' : 'station'}`} />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {bulkUpdateField === 'categoryId' && categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          {bulkUpdateField === 'subcategoryId' && subcategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({categories.find(c => c.id === s.categoryId)?.name})</SelectItem>)}
                          {bulkUpdateField === 'stationId' && stations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsBulkUpdateDialogOpen(false)} disabled={isActionPending}>Cancel</Button>
                  <Button onClick={handleConfirmBulkUpdate} disabled={!bulkUpdateValue || isActionPending}>
                      {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update All
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={!!whereUsedItem} onOpenChange={(open) => {
          if (!open) {
              setWhereUsedItem(null);
              forceInteractivity();
          }
      }}>
          <DialogContent className="sm:max-w-xl" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Where Used: {whereUsedItem?.name}
                  </DialogTitle>
                  <DialogDescription>
                      This ingredient is used in the following composite items.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  {itemsUsingSelected.length > 0 ? (
                      <div className="rounded-md border max-h-[400px] overflow-auto">
                          <Table>
                              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                  <TableRow>
                                      <TableHead>Product Name</TableHead>
                                      <TableHead>Category</TableHead>
                                      <TableHead className="text-right">Usage Qty</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {itemsUsingSelected.map(product => {
                                      const usage = product.components?.find(c => c.itemId === whereUsedItem?.id);
                                      const category = categories.find(c => c.id === product.categoryId);
                                      return (
                                          <TableRow key={product.id}>
                                              <TableCell className="font-medium">{product.name}</TableCell>
                                              <TableCell>
                                                  {category && (
                                                      <Badge variant="outline" style={{ borderLeft: `4px solid ${category.color}` }} className="px-2">
                                                          {category.name}
                                                      </Badge>
                                                  )}
                                              </TableCell>
                                              <TableCell className="text-right font-mono font-bold text-primary">
                                                  {usage?.quantity} {whereUsedItem?.soldBy === 'volume' ? 'g/ml' : ''}
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-lg border border-dashed">
                          <X className="h-10 w-10 text-muted-foreground/30 mb-2" />
                          <p className="text-sm font-medium text-muted-foreground">Not used in any composite items.</p>
                          <p className="text-xs text-muted-foreground mt-1">This item is currently stand-alone or a direct sellable.</p>
                      </div>
                  )}
              </div>
              <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setWhereUsedItem(null)}>Close</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
