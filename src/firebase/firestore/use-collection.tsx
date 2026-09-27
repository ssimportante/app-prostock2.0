'use client';

import useSWR from 'swr';
import { convertTimestamps } from '@/lib/fake-timestamp';
import { getCollectionPath, getConstraints } from '@/lib/firestore-shim';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch ${url}`);
  }
  const json = await res.json();
  return (json.data || []).map((d: any) => convertTimestamps(d));
};

export function useCollection<T = any>(
  memoizedTargetRefOrQuery: any
): UseCollectionResult<T> {
  // Build the SWR key from the query
  let swrKey: string | null = null;

  if (memoizedTargetRefOrQuery) {
    const collectionName = getCollectionPath(memoizedTargetRefOrQuery);
    const constraints = getConstraints(memoizedTargetRefOrQuery);

    if (collectionName) {
      const params = new URLSearchParams();
      if (constraints.length > 0) {
        const whereConstraints = constraints.filter((c: any) => c.type === 'where');
        if (whereConstraints.length > 0) {
          params.set('where', JSON.stringify(whereConstraints.map((c: any) => ({ field: c.field, op: c.op, value: c.value }))));
        }
        const orderByConstraint = constraints.find((c: any) => c.type === 'orderBy');
        if (orderByConstraint) {
          params.set('orderBy', orderByConstraint.field);
          params.set('orderDir', orderByConstraint.direction);
        }
        const limitConstraint = constraints.find((c: any) => c.type === 'limit');
        if (limitConstraint) {
          params.set('limit', String(limitConstraint.limit));
        }
      }
      swrKey = `/api/db/${collectionName}${params.toString() ? `?${params}` : ''}`;
    }
  }

  const { data, error, isLoading } = useSWR(
    swrKey,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 2000 }
  );

  return {
    data: data ?? null,
    isLoading: isLoading && !!swrKey,
    error: error ?? null,
  };
}
