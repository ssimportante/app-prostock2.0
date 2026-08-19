
'use client';

import StockActivityClient from '@/components/stock-activity/StockActivityClient';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StockReceiptWithId, WasteEvent, AppUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

function StockActivitySkeleton() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-6 w-96 mb-6" />
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
}

export default function StockActivityPage() {
    const firestore = useFirestore();

    const receiptsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'stockReceipts'), orderBy('date', 'desc'));
    }, [firestore]);
    const wasteQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'wasteEvents'), orderBy('date', 'desc'));
    }, [firestore]);
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const { data: receipts } = useCollection<StockReceiptWithId>(receiptsQuery);
    const { data: wasteEvents } = useCollection<WasteEvent>(wasteQuery);
    const { data: users } = useCollection<AppUser>(usersQuery);

    if (!receipts || !wasteEvents || !users) {
        return <StockActivitySkeleton />;
    }
    
    return <StockActivityClient receipts={receipts} wasteEvents={wasteEvents} users={users} />;
}
