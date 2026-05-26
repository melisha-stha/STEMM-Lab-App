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
  const surface = useThemeColor({}, 'surface');
  const isDark = colorScheme === 'dark';

  const pixelShadow = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const primaryBg = isDark ? PIXEL_BRAND.purpleLight : PIXEL_BRAND.purple;
  const primaryBorder = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const primaryText = PIXEL_BRAND.white;
  const secondaryBg = isDark ? surface : PIXEL_BRAND.purpleSoft;
  const secondaryBorder = isDark ? '#9CA3AF' : PIXEL_BRAND.purpleBorder;
  const secondaryText = isDark ? PIXEL_BRAND.white : PIXEL_BRAND.purple;

  const showPrimaryFill = selected || (!hasSelection && variant === 'primary');
  const bg = showPrimaryFill ? primaryBg : secondaryBg;
  const border = showPrimaryFill ? primaryBorder : secondaryBorder;
  const fg = showPrimaryFill ? primaryText : secondaryText;

  return (
    <PixelBox shadowColor={pixelShadow} style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: bg, borderColor: border },
          pressed && styles.pressed,
        ]}>
        {!loaded ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <View style={styles.textWrap}>
            <Text
              adjustsFontSizeToFit
              numberOfLines={2}
              style={[styles.label, { color: fg, fontFamily: pixelFamily }]}>
              {label}
            </Text>
            {description ? (
              <Text
                adjustsFontSizeToFit
                numberOfLines={3}
                style={[styles.description, { color: fg, fontFamily: pixelFamily, opacity: 0.9 }]}>
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
