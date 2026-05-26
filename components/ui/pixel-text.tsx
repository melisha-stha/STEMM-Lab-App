import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { usePixelFont } from '@/hooks/use-pixel-font';
import React from 'react';
import { StyleSheet, Text, useColorScheme, type TextStyle } from 'react-native';

type Variant = 'subtitle' | 'caption' | 'step';

type Props = {
  children: string;
  variant?: Variant;
  style?: TextStyle;
};

export function PixelText({ children, variant = 'subtitle', style }: Props) {
  const colorScheme = useColorScheme();
  const { loaded, family: pixelFamily } = usePixelFont();
  const isDark = colorScheme === 'dark';
  const color = isDark ? '#9CA3AF' : PIXEL_BRAND.textMuted;

  if (!loaded) return null;

  return (
    <Text style={[styles[variant], { color, fontFamily: pixelFamily }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  caption: {
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  step: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
});
