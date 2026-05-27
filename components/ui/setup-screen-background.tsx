import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { Image } from 'expo-image';
import React from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyleSheet, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/minelibrary.jpeg');

export function useSetupScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(26, 10, 38, 0.62)' : 'rgba(243, 232, 255, 0.55)',
    imageOpacity: isDark ? 0.62 : 0.74,
  };
}

type SetupScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function SetupScreenBackground({ overlayColor, imageOpacity }: SetupScreenBackgroundProps) {
  return (
    <View style={styles.layer} pointerEvents="none">
      <Image
        source={BACKGROUND_SOURCE}
        style={[styles.image, { opacity: imageOpacity }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
    </View>
  );
}

export const setupScreenSafeBackground = PIXEL_BRAND.purpleSoft;

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
