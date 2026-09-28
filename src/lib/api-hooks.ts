'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Global refresh system - allows any component to trigger a re-fetch of all collections
type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();

export function refreshAllData() {
  refreshListeners.forEach(fn => fn());
}

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;

export interface UseApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useApiCollection<T = any>(endpoint: string | null): UseApiResult<T[]> {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!endpoint ? false : true);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!endpoint) {
      setData(null);
      setIsLoading(false);
      return;
    }
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const res = await fetch(endpoint, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!endpoint) {
      setData(null);
      setIsLoading(false);
      return;
    }

    fetchData();

    // Poll periodically
    const interval = setInterval(fetchData, POLL_INTERVAL);

    // Listen for global refresh events
    const listener = () => fetchData();
    refreshListeners.add(listener);

    return () => {
      clearInterval(interval);
      refreshListeners.delete(listener);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [endpoint, fetchData]);

  return { data, isLoading, error, refresh: fetchData };
}

export function useApiDoc<T = any>(endpoint: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!endpoint ? false : true);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!endpoint) {
      setData(null);
      setIsLoading(false);
      return;
    }
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const res = await fetch(endpoint, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!endpoint) {
      setData(null);
      setIsLoading(false);
      return;
    }

    fetchData();

    const interval = setInterval(fetchData, POLL_INTERVAL);
    const listener = () => fetchData();
    refreshListeners.add(listener);

    return () => {
      clearInterval(interval);
      refreshListeners.delete(listener);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [endpoint, fetchData]);

  return { data, isLoading, error, refresh: fetchData };
}

// Helper for making API mutations (POST/PUT/DELETE) with automatic global refresh
export async function apiMutation(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: any
): Promise<any> {
  const res = await fetch(endpoint, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `API error: ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  // Trigger global refresh after successful mutation
  setTimeout(() => refreshAllData(), 100);
  return json;
}
