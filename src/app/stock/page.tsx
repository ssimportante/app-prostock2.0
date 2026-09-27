
'use client';

import StockManager from '../../components/stock/StockManager';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { ItemWithId, CategoryWithId, StaffWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function StockPage() {
  const firestore = useFirestore();

  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'items'));
  }, [firestore]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'));
  }, [firestore]);
  
  const staffQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'staff'));
  }, [firestore]);

  const { data: items } = useCollection<ItemWithId>(itemsQuery);
  const { data: categories } = useCollection<CategoryWithId>(categoriesQuery);
  const { data: staff } = useCollection<StaffWithId>(staffQuery);

  if (!items || !categories || !staff) {
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
        <StockManager initialItems={items} categories={categories} staff={staff} />
      </div>
    </div>
  );
}
