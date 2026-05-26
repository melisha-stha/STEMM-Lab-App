import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { usePixelFont } from '@/hooks/use-pixel-font';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

type Props = {
  children: string;
};

export function PixelHeading({ children }: Props) {
  const colorScheme = useColorScheme();
  const { loaded, family: pixelFamily } = usePixelFont();
  const isDark = colorScheme === 'dark';
  const color = isDark ? PIXEL_BRAND.white : PIXEL_BRAND.purple;

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color} />
      </View>
    );
  }

  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={1}
      style={[styles.heading, { color, fontFamily: pixelFamily }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  loading: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
