
'use client';

import SalesTerminal from '@/components/sales/SalesTerminal';
import { ItemWithId, CategoryWithId, SubcategoryWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

function SalesSkeleton() {
  return (
    <div className="flex h-[calc(100vh_-_theme(spacing.16))]">
      <div className="flex-1 p-4 overflow-y-auto">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4 mt-2" />
              <Skeleton className="h-3 w-1/2 mt-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-96 border-l bg-card flex flex-col">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}


export default function SalesPage() {
  const firestore = useFirestore();

  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Fetch all items so that composite item components are available for stock deduction
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

  const { data: items } = useCollection<ItemWithId>(itemsQuery);
  const { data: categories } = useCollection<CategoryWithId>(categoriesQuery);
  const { data: subcategories } = useCollection<SubcategoryWithId>(subcategoriesQuery);
  
  if (!items || !categories || !subcategories) {
    return <SalesSkeleton />;
  }

  return (
    <SalesTerminal 
        initialItems={items} 
        initialCategories={categories} 
        initialSubcategories={subcategories}
    />
  );
}
