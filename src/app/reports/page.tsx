'use client';

import ReportsClient from '@/components/reports/ReportsClient';
import type { ItemWithId, CategoryWithId, SaleWithId, WasteEvent, SubcategoryWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiCollection } from '@/lib/api-hooks';

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
  const { data: items } = useApiCollection<ItemWithId>('/api/items');
  const { data: categories } = useApiCollection<CategoryWithId>('/api/categories');
  const { data: subcategories } = useApiCollection<SubcategoryWithId>('/api/subcategories');
  const { data: sales } = useApiCollection<SaleWithId>('/api/sales');
  const { data: wasteEvents } = useApiCollection<WasteEvent>('/api/wasteEvents');

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
