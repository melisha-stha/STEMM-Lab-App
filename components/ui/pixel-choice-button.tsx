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
  View,
  type ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  description?: string;
  variant?: Variant;
  selected: boolean;
  hasSelection: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

export function PixelChoiceButton({
  label,
  description,
  variant = 'primary',
  selected,
  hasSelection,
  onPress,
  style,
}: Props) {
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
  const showPrimaryFill = selected || (!hasSelection && variant === 'primary');

  const bg = showPrimaryFill ? primary : isDark ? surface : primarySoft;
  const borderColor = showPrimaryFill ? (isDark ? '#000000' : primaryDark) : isDark ? border : PIXEL_BRAND.purpleBorder;
  const fg = showPrimaryFill ? onPrimary : isDark ? text : primary;

  return (
    <PixelBox shadowColor={pixelShadow} style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: bg, borderColor },
          pressed && styles.pressed,
        ]}>
        {!loaded ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <View style={styles.textWrap}>
            <Text
              adjustsFontSizeToFit={Platform.OS !== 'android'}
              numberOfLines={2}
              allowFontScaling={false}
              style={withPixelFontStyle(pixelFamily, styles.label, { color: fg })}>
              {label}
            </Text>
            {description ? (
              <Text
                adjustsFontSizeToFit={Platform.OS !== 'android'}
                numberOfLines={3}
                allowFontScaling={false}
                style={withPixelFontStyle(pixelFamily, styles.description, { color: fg, opacity: 0.92 })}>
                {description}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </PixelBox>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 84,
    borderRadius: PIXEL_RADIUS + 2,
    borderWidth: PIXEL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textWrap: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
});
