'use client';

import { createContext, useContext, type ReactNode, useMemo } from 'react';
import { PosSettings } from '@/types';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';

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
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'settings', 'pos');
  }, [firestore, user]);
  
  const { data, isLoading: isSettingsLoading } = useDoc<PosSettings>(settingsRef);
  
  const settings = data || defaultSettings;
  const loading = isUserLoading || (!!user && isSettingsLoading);

  const contextValue = useMemo(() => ({
    settings,
    setSettings: () => {}, // In this prototype, settings updates are handled directly in PosSettingsManager
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
