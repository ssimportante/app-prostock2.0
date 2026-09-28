'use client';

import ItemsClient from '@/components/items/ItemsClient';
import type { ItemWithId, CategoryWithId, StationWithId, SubcategoryWithId, SaleWithId, StockReceiptWithId, WasteEvent } from '@/types';
import { useApiCollection } from '@/lib/api-hooks';
import { ClientOnly } from '@/components/ClientOnly';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function ItemsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-5 w-80 mb-6" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function ItemsPage() {
  const { data: items, isLoading: isLoadingItems } = useApiCollection<ItemWithId>('/api/items');
  const { data: categories, isLoading: isLoadingCategories } = useApiCollection<CategoryWithId>('/api/categories');
  const { data: subcategories, isLoading: isLoadingSubcategories } = useApiCollection<SubcategoryWithId>('/api/subcategories');
  const { data: stations, isLoading: isLoadingStations } = useApiCollection<StationWithId>('/api/stations');
  const { data: sales } = useApiCollection<SaleWithId>('/api/sales');
  const { data: receipts } = useApiCollection<StockReceiptWithId>('/api/stockReceipts');
  const { data: waste } = useApiCollection<WasteEvent>('/api/wasteEvents');

  return (
    <ClientOnly>
      <Suspense fallback={<ItemsLoading />}>
        <ItemsClient
          items={items || []}
          categories={categories || []}
          subcategories={subcategories || []}
          stations={stations || []}
          sales={sales || []}
          receipts={receipts || []}
          wasteEvents={waste || []}
          isLoading={isLoadingItems || isLoadingCategories || isLoadingSubcategories || isLoadingStations}
        />
      </Suspense>
    </ClientOnly>
  );
}
