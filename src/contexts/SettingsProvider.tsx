'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api-client';
import type { PosSettings, Tax } from '@/lib/types';

interface SettingsContextValue {
  settings: PosSettings;
  taxes: Tax[];
  loading: boolean;
  reload: () => Promise<void>;
}

const defaultSettings: PosSettings = { currency: '₱', defaultSaleType: 'dine-in' };

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  taxes: [],
  loading: true,
  reload: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PosSettings>(defaultSettings);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ settings: PosSettings; taxes: Tax[] }>('/api/settings');
      setSettings(data.settings);
      setTaxes(data.taxes ?? []);
    } catch {
      // keep defaults; toast handled by callers where relevant
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, taxes, loading, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
