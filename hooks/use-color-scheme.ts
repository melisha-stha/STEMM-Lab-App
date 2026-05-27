import { ThemePreferenceContext } from '@/contexts/theme-preference';
import { useContext } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

/** App theme: saved in-app choice when set, otherwise device light/dark. */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const preference = useContext(ThemePreferenceContext);

  if (preference) {
    return preference.colorScheme;
  }

  return system === 'dark' ? 'dark' : 'light';
}
