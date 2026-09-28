'use client';

import { createContext, useContext, type ReactNode, useMemo, useState, useEffect } from 'react';
import { PosSettings } from '@/types';
import { useApiDoc } from '@/lib/api-hooks';

interface SettingsContextType {
  settings: PosSettings;
  setSettings: (settings: PosSettings) => void;
  loading: boolean;
}

const defaultSettings: PosSettings = {
    defaultSaleType: 'dine-in',
    currency: 'USD',
};

const SettingsContext = createContext<SettingsContextType>({
    settings: defaultSettings,
    setSettings: () => {},
    loading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useApiDoc<PosSettings>('/api/settings/pos');

  const settings = data || defaultSettings;
  const loading = isLoading;

  const contextValue = useMemo(() => ({
    settings,
    setSettings: () => {},
    loading
  }), [settings, loading]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
