import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/background.jpg');

export function useAuthScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(26, 10, 38, 0.72)' : 'rgba(243, 232, 255, 0.66)',
    imageOpacity: isDark ? 0.52 : 0.62,
  };
}

type AuthScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function AuthScreenBackground({ overlayColor, imageOpacity }: AuthScreenBackgroundProps) {
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

export const authScreenSafeBackground = PIXEL_BRAND.purpleSoft;

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
