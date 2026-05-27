import { Image } from 'expo-image';
import React from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyleSheet, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/earthquake-background.png');

export function useEarthquakeScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(13, 13, 31, 0.72)' : 'rgba(255, 255, 255, 0.58)',
    imageOpacity: isDark ? 0.5 : 0.62,
  };
}

type EarthquakeScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function EarthquakeScreenBackground({
  overlayColor,
  imageOpacity,
}: EarthquakeScreenBackgroundProps) {
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
