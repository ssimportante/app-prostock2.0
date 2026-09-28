'use client';

import SalesTerminal from '@/components/sales/SalesTerminal';
import { ItemWithId, CategoryWithId, SubcategoryWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiCollection } from '@/lib/api-hooks';

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
  const { data: items } = useApiCollection<ItemWithId>('/api/items');
  const { data: categories } = useApiCollection<CategoryWithId>('/api/categories');
  const { data: subcategories } = useApiCollection<SubcategoryWithId>('/api/subcategories');
  
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
