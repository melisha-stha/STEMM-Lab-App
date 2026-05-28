import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/breathing-background.png');

export function useBreathingScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(10, 14, 34, 0.70)' : 'rgba(226, 232, 255, 0.62)',
    imageOpacity: isDark ? 0.55 : 0.70,
  };
}

type BreathingScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function BreathingScreenBackground({
  overlayColor,
  imageOpacity,
}: BreathingScreenBackgroundProps) {
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

