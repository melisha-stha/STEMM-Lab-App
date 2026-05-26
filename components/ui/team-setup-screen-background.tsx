import { PIXEL_BRAND } from '@/constants/pixel-brand';
import React from 'react';
import { ImageBackground, StyleSheet, useColorScheme, View } from 'react-native';

const BACKGROUND_SOURCE = require('@/assets/images/teamsetup.jpeg');

export function useTeamSetupScreenBackground() {
  const isDark = useColorScheme() === 'dark';

  return {
    overlayColor: isDark ? 'rgba(26, 10, 38, 0.62)' : 'rgba(243, 232, 255, 0.55)',
    imageOpacity: isDark ? 0.62 : 0.74,
  };
}

type TeamSetupScreenBackgroundProps = {
  overlayColor: string;
  imageOpacity: number;
  children: React.ReactNode;
};

export function TeamSetupScreenBackground({
  overlayColor,
  imageOpacity,
  children,
}: TeamSetupScreenBackgroundProps) {
  return (
    <ImageBackground
      source={BACKGROUND_SOURCE}
      style={styles.root}
      resizeMode="cover"
      imageStyle={{ opacity: imageOpacity }}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

export const teamSetupScreenSafeBackground = PIXEL_BRAND.purpleSoft;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: teamSetupScreenSafeBackground,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
  },
});
