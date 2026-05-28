import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/handfan-background.png');

export function useHandFanScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(10, 10, 18, 0.68)' : 'rgba(236, 245, 255, 0.58)',
    imageOpacity: isDark ? 0.55 : 0.72,
  };
}

type HandFanScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function HandFanScreenBackground({ overlayColor, imageOpacity }: HandFanScreenBackgroundProps) {
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

