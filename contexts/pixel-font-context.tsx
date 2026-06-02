import { getPixelFontFamily } from '@/hooks/pixel-font-utils';
import { PressStart2P_400Regular, useFonts } from '@expo-google-fonts/press-start-2p';
import React, { createContext, useContext, useMemo } from 'react';

type PixelFontContextValue = {
  loaded: boolean;
  error: Error | null;
  family: string | undefined;
};

const PixelFontContext = createContext<PixelFontContextValue>({
  loaded: false,
  error: null,
  family: undefined,
});

export function PixelFontProvider({ children }: { children: React.ReactNode }) {
  const [loaded, error] = useFonts({
    PressStart2P_400Regular,
  });

  const value = useMemo(
    () => ({
      loaded,
      error: error ?? null,
      family: getPixelFontFamily(loaded),
    }),
    [loaded, error]
  );

  return <PixelFontContext.Provider value={value}>{children}</PixelFontContext.Provider>;
}

export function usePixelFontContext(): PixelFontContextValue {
  return useContext(PixelFontContext);
}
