
'use client';

import ReportsClient from '@/components/reports/ReportsClient';
import type { ItemWithId, CategoryWithId, SaleWithId, WasteEvent, SubcategoryWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

function ReportsSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-5 w-80 mb-6" />
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

export default function ReportsPage() {
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
  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sales'));
  }, [firestore]);
  const wasteQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'wasteEvents'));
  }, [firestore]);

  const { data: items } = useCollection<ItemWithId>(itemsQuery);
  const { data: categories } = useCollection<CategoryWithId>(categoriesQuery);
  const { data: subcategories } = useCollection<SubcategoryWithId>(subcategoriesQuery);
  const { data: sales } = useCollection<SaleWithId>(salesQuery);
  const { data: wasteEvents } = useCollection<WasteEvent>(wasteQuery);

  if (!items || !categories || !subcategories || !sales || !wasteEvents) {
    return <ReportsSkeleton />;
  }

  return (
    <ReportsClient 
        items={items} 
        categories={categories} 
        subcategories={subcategories}
        sales={sales} 
        wasteEvents={wasteEvents} 
    />
  );
}
