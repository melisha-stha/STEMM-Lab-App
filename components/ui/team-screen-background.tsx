import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const BACKGROUND_SOURCE = require('@/assets/images/team-background.png');

export function useTeamScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(10, 10, 20, 0.78)' : 'rgba(243, 232, 255, 0.62)',
    imageOpacity: isDark ? 0.55 : 0.72,
  };
}

type TeamScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function TeamScreenBackground({ overlayColor, imageOpacity }: TeamScreenBackgroundProps) {
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

