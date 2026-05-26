import { PixelBox } from '@/components/ui/pixel-box';
import { PIXEL_BORDER, PIXEL_BRAND, PIXEL_RADIUS } from '@/constants/pixel-brand';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

export function PixelButton({ label, onPress, disabled, variant = 'primary', style }: Props) {
  const colorScheme = useColorScheme();
  const { loaded, family: pixelFamily } = usePixelFont();
  const surface = useThemeColor({}, 'surface');
  const isDark = colorScheme === 'dark';

  const pixelShadow = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const primaryBg = isDark ? PIXEL_BRAND.purpleLight : PIXEL_BRAND.purple;
  const primaryBorder = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const primaryText = PIXEL_BRAND.white;
  const secondaryBg = isDark ? surface : PIXEL_BRAND.purpleSoft;
  const secondaryBorder = isDark ? '#9CA3AF' : PIXEL_BRAND.purpleBorder;
  const secondaryText = isDark ? PIXEL_BRAND.white : PIXEL_BRAND.purple;

  const isPrimary = variant === 'primary';
  const bg = isPrimary ? primaryBg : secondaryBg;
  const border = isPrimary ? primaryBorder : secondaryBorder;
  const fg = isPrimary ? primaryText : secondaryText;

  return (
    <PixelBox shadowColor={pixelShadow} style={style}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || !loaded}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 },
          pressed && !disabled && styles.pressed,
        ]}>
        {!loaded ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <Text
            adjustsFontSizeToFit
            numberOfLines={2}
            style={[styles.label, { color: fg, fontFamily: pixelFamily }]}>
            {label}
          </Text>
        )}
      </Pressable>
    </PixelBox>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 56,
    borderRadius: PIXEL_RADIUS + 2,
    borderWidth: PIXEL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
});
