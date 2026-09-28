'use client';

import SettingsClient from '@/components/settings/SettingsClient';
import type { CategoryWithId, StationWithId, TaxWithId, AppUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiCollection } from '@/lib/api-hooks';

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
  const { data: categories } = useApiCollection<CategoryWithId>('/api/categories');
  const { data: stations } = useApiCollection<StationWithId>('/api/stations');
  const { data: taxes } = useApiCollection<TaxWithId>('/api/taxes');
  const { data: users } = useApiCollection<AppUser>('/api/users');

  if (!categories || !stations || !taxes || !users) {
    return <SettingsSkeleton />;
  }

  return (
    <SettingsClient categories={categories} stations={stations} taxes={taxes} users={users} />
  );
}
