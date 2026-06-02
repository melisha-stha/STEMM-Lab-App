import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { usePanelFieldColors } from '@/components/ui/activity-color-panel';
import { Radius, Spacing, Typography } from '@/constants/design';
import { usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  rightAccessory?: React.ReactNode;
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  rightAccessory,
  style,
}: Props) {
  const { foreground, surface, border: panelBorder } = usePanelFieldColors();
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const danger = useThemeColor({}, 'danger');

  const bg =
    variant === 'primary' ? primary : variant === 'danger' ? danger : surface;
  const fg = variant === 'secondary' ? foreground : onPrimary;
  const bd = variant === 'secondary' ? panelBorder : 'transparent';
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const useAndroidPixel = Platform.OS === 'android' && pixelFontLoaded && pixelFamily;
  const labelStyle = useAndroidPixel
    ? withPixelFontStyle(pixelFamily, styles.label, styles.labelAndroid, { color: fg })
    : [styles.label, { color: fg }];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        Platform.OS === 'android' ? styles.baseAndroid : null,
        { backgroundColor: bg, borderColor: bd, opacity: disabled ? 0.5 : 1 },
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}>
      <Text
        style={labelStyle}
        numberOfLines={Platform.OS === 'android' ? 2 : 1}
        adjustsFontSizeToFit={false}
        allowFontScaling={false}>
        {label}
      </Text>
      {rightAccessory ? <View style={styles.right}>{rightAccessory}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  baseAndroid: {
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  label: {
    ...Typography.section,
    fontSize: 15,
  },
  labelAndroid: {
    textAlign: 'center',
  },
  right: {
    marginLeft: Spacing.xs,
  },
});

