'use client';

import ItemsClient from '@/components/items/ItemsClient';
import type { ItemWithId, CategoryWithId, StationWithId, SubcategoryWithId, SaleWithId, StockReceiptWithId, WasteEvent } from '@/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
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
  const firestore = useFirestore();

  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'items'));
  }, [firestore]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'));
  }, [firestore]);

  const subcategoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subcategories'));
  }, [firestore]);

  const stationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'stations'));
  }, [firestore]);

  // Fetch history collections for accurate historical "As Of" calculations
  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sales'));
  }, [firestore]);

  const receiptsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'stockReceipts'));
  }, [firestore]);

  const wasteQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'wasteEvents'));
  }, [firestore]);

  const { data: items, isLoading: isLoadingItems } = useCollection<ItemWithId>(itemsQuery);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<CategoryWithId>(categoriesQuery);
  const { data: subcategories, isLoading: isLoadingSubcategories } = useCollection<SubcategoryWithId>(subcategoriesQuery);
  const { data: stations, isLoading: isLoadingStations } = useCollection<StationWithId>(stationsQuery);
  
  const { data: sales } = useCollection<SaleWithId>(salesQuery);
  const { data: receipts } = useCollection<StockReceiptWithId>(receiptsQuery);
  const { data: waste } = useCollection<WasteEvent>(wasteQuery);

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
