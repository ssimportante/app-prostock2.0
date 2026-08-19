'use client';

import { ItemForm } from '@/components/items/ItemForm';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { ItemWithId, CategoryWithId, StationWithId, TaxWithId } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function NewItemPageSkeleton() {
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

function NewItemPageContent() {
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const duplicateId = searchParams.get('duplicate');

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'categories'));
    }, [firestore]);
    const stationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'stations'));
    }, [firestore]);
    const simpleItemsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'items'));
    }, [firestore]);
    const taxesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'taxes'));
    }, [firestore]);

    const itemToDuplicateRef = useMemoFirebase(() => {
        if (!firestore || !duplicateId) return null;
        return doc(firestore, 'items', duplicateId);
    }, [firestore, duplicateId]);

    const { data: categories } = useCollection<CategoryWithId>(categoriesQuery);
    const { data: stations } = useCollection<StationWithId>(stationsQuery);
    const { data: allItems } = useCollection<ItemWithId>(simpleItemsQuery);
    const { data: taxes } = useCollection<TaxWithId>(taxesQuery);
    const { data: itemToDuplicate, isLoading: isLoadingDuplicate } = useDoc<ItemWithId>(itemToDuplicateRef);

    if (!categories || !stations || !allItems || !taxes || (duplicateId && isLoadingDuplicate)) {
        return <NewItemPageSkeleton />;
    }

    const simpleItems = allItems?.filter(i => i.inventoryType === 'simple') || [];
    
    let itemForForm: any = undefined;

    if (duplicateId && itemToDuplicate) {
        const { id, stockBatches, ...rest } = itemToDuplicate;
        itemForForm = {
            ...rest,
            name: `${itemToDuplicate.name} (Copy)`,
            sku: '',
            barcode: '',
        };
    }

    return (
        <ItemForm 
            item={itemForForm}
            categories={categories || []} 
            stations={stations || []}
            simpleItems={simpleItems}
            taxes={taxes || []}
        />
    );
}

export default function NewItemPage() {
    return (
        <Suspense fallback={<NewItemPageSkeleton />}>
            <NewItemPageContent />
        </Suspense>
    );
}
