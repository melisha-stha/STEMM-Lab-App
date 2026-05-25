import { useFonts } from 'expo-font';

export function usePixelFont() {
  const [loaded, error] = useFonts({
    PixelFont: require('@/assets/fonts/PixelFont.ttf'),
  });

  return { loaded, error, family: loaded ? 'PixelFont' : undefined };
}
