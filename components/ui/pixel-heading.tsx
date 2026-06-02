import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: string;
  align?: 'left' | 'center';
};

export function PixelHeading({ children, align = 'center' }: Props) {
  const colorScheme = useColorScheme();
  const { loaded, family: pixelFamily } = usePixelFont();
  const isDark = colorScheme === 'dark';
  const text = useThemeColor({}, 'text');
  const primary = useThemeColor({}, 'primary');
  const color = isDark ? text : primary ?? PIXEL_BRAND.purple;

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color} />
      </View>
    );
  }

  return (
    <Text
      adjustsFontSizeToFit={Platform.OS !== 'android'}
      numberOfLines={2}
      allowFontScaling={false}
      style={withPixelFontStyle(
        pixelFamily,
        styles.heading,
        align === 'left' ? styles.alignLeft : styles.alignCenter,
        { color }
      )}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1,
    marginBottom: 8,
  },
  alignCenter: {
    textAlign: 'center',
  },
  alignLeft: {
    textAlign: 'left',
  },
  loading: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
