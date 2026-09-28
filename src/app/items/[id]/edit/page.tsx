'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ItemForm } from '@/components/items/ItemForm';
import { useApiCollection, useApiDoc } from '@/lib/api-hooks';
import { ItemWithId, CategoryWithId, StationWithId, TaxWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

function EditItemPageSkeleton() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-6 w-96 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        </div>
    );
}

export default function EditItemPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: item } = useApiDoc<ItemWithId>(id ? `/api/items/${id}` : null);
  const { data: categories } = useApiCollection<CategoryWithId>('/api/categories');
  const { data: stations } = useApiCollection<StationWithId>('/api/stations');
  const { data: allItems } = useApiCollection<ItemWithId>('/api/items');
  const { data: taxes } = useApiCollection<TaxWithId>('/api/taxes');

  if (!item || !categories || !stations || !allItems || !taxes) {
    return <EditItemPageSkeleton />;
  }

  const simpleItems = allItems?.filter(i => i.inventoryType === 'simple' && i.id !== item.id) || [];
  
  return (
    <ItemForm 
        item={item} 
        categories={categories || []} 
        stations={stations || []} 
        simpleItems={simpleItems}
        taxes={taxes || []}
    />
  );
}
