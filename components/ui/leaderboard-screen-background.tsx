import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/leaderboard-background.png');

export function useLeaderboardScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(13, 13, 31, 0.74)' : 'rgba(255, 255, 255, 0.6)',
    imageOpacity: isDark ? 0.48 : 0.65,
  };
}

type LeaderboardScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
};

export function LeaderboardScreenBackground({
  overlayColor,
  imageOpacity,
}: LeaderboardScreenBackgroundProps) {
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
