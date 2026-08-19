
'use client';

import SettingsClient from '@/components/settings/SettingsClient';
import type { CategoryWithId, StationWithId, TaxWithId, AppUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

function SettingsSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-5 w-80 mb-6" />
      <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8">
        <div className="space-y-1 hidden md:flex flex-col">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-6 mt-4 md:mt-0">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const firestore = useFirestore();
  
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'));
  }, [firestore]);

  const stationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'stations'));
  }, [firestore]);

  const taxesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'taxes'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: categories } = useCollection<CategoryWithId>(categoriesQuery);
  const { data: stations } = useCollection<StationWithId>(stationsQuery);
  const { data: taxes } = useCollection<TaxWithId>(taxesQuery);
  const { data: users } = useCollection<AppUser>(usersQuery);

  if (!categories || !stations || !taxes || !users) {
    return <SettingsSkeleton />;
  }

  return (
    <SettingsClient categories={categories} stations={stations} taxes={taxes} users={users} />
  );
}
