import { PixelBox } from '@/components/ui/pixel-box';
import { PIXEL_BORDER, PIXEL_BRAND, PIXEL_RADIUS } from '@/constants/pixel-brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  const isDark = colorScheme === 'dark';

  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const text = useThemeColor({}, 'text');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  const pixelShadow = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const isPrimary = variant === 'primary';

  const bg = isPrimary ? primary : isDark ? surface : primarySoft;
  const borderColor = isPrimary ? (isDark ? '#000000' : primaryDark) : isDark ? border : PIXEL_BRAND.purpleBorder;
  const fg = isPrimary ? onPrimary : isDark ? text : primary;

  return (
    <PixelBox shadowColor={pixelShadow} style={style}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || !loaded}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : 1 },
          pressed && !disabled && styles.pressed,
        ]}>
        {!loaded ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <Text
            adjustsFontSizeToFit={false}
            numberOfLines={2}
            allowFontScaling={false}
            style={withPixelFontStyle(pixelFamily, styles.label, { color: fg })}>
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
    ...Platform.select({
      android: { minHeight: 60, paddingVertical: 16 },
      default: {},
    }),
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
