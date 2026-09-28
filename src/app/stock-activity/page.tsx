'use client';

import StockActivityClient from '@/components/stock-activity/StockActivityClient';
import { useApiCollection } from '@/lib/api-hooks';
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
    const { data: receipts } = useApiCollection<StockReceiptWithId>('/api/stockReceipts?orderBy=desc');
    const { data: wasteEvents } = useApiCollection<WasteEvent>('/api/wasteEvents?orderBy=desc');
    const { data: users } = useApiCollection<AppUser>('/api/users');

    if (!receipts || !wasteEvents || !users) {
        return <StockActivitySkeleton />;
    }
    
    return <StockActivityClient receipts={receipts} wasteEvents={wasteEvents} users={users} />;
}
