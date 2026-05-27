import { getColorSchemePreference, saveColorSchemePreference } from '@/hooks/storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type AppColorScheme = 'light' | 'dark';

type ThemePreferenceContextValue = {
  colorScheme: AppColorScheme;
  isDark: boolean;
  isReady: boolean;
  setColorScheme: (scheme: AppColorScheme) => void;
};

export const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreference] = useState<AppColorScheme | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getColorSchemePreference();
      if (stored) {
        setPreference(stored);
        return;
      }
      setPreference(systemScheme === 'dark' ? 'dark' : 'light');
    })();
  }, [systemScheme]);

  const colorScheme: AppColorScheme =
    preference ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const setColorScheme = useCallback((scheme: AppColorScheme) => {
    setPreference(scheme);
    void saveColorSchemePreference(scheme);
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      isDark: colorScheme === 'dark',
      isReady: preference !== null,
      setColorScheme,
    }),
    [colorScheme, preference, setColorScheme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }
  return ctx;
}
