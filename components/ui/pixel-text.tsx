import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

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
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const color = isDark ? text : mutedText;

  if (!loaded) return null;

  return (
    <Text style={withPixelFontStyle(pixelFamily, styles[variant], { color }, style)} allowFontScaling={false}>
      {children}
    </Text>
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
