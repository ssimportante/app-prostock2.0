'use client';

import useSWR from 'swr';
import { convertTimestamps } from '@/lib/fake-timestamp';

export type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
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
  return convertTimestamps(json.data);
};

export function useDoc<T = any>(
  memoizedDocRef: any
): UseDocResult<T> {
  let swrKey: string | null = null;

  if (memoizedDocRef) {
    const [collection, id] = memoizedDocRef.path.split('/');
    if (collection && id) {
      swrKey = `/api/db/${collection}/${id}`;
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
