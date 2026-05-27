import { ThemePreferenceContext } from '@/contexts/theme-preference';
import { useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const system = useSystemColorScheme();
  const preference = useContext(ThemePreferenceContext);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  if (preference) {
    return preference.colorScheme;
  }

  return system === 'dark' ? 'dark' : 'light';
}
