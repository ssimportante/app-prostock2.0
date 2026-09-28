'use client';

import StockManager from '../../components/stock/StockManager';
import { useApiCollection } from '@/lib/api-hooks';
import type { ItemWithId, CategoryWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function StockPage() {
  const { data: items } = useApiCollection<ItemWithId>('/api/items');
  const { data: categories } = useApiCollection<CategoryWithId>('/api/categories');

  if (!items || !categories) {
      return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-headline font-bold tracking-tight">Stock Management</h1>
            <p className="text-muted-foreground">Receive new stock and record waste or spoilage.</p>
            <div className="mt-6">
                <div className="w-full max-w-2xl mx-auto space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-headline font-bold tracking-tight">Stock Management</h1>
      <p className="text-muted-foreground">Receive new stock and record waste or spoilage.</p>
      <div className="mt-6">
        <StockManager initialItems={items} categories={categories} />
      </div>
    </div>
  );
}
