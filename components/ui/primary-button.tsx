import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/design';
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
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const text = useThemeColor({}, 'text');

  const bg =
    variant === 'primary' ? primary : variant === 'danger' ? danger : card;
  const fg = variant === 'secondary' ? text : onPrimary;
  const bd = variant === 'secondary' ? border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: bd, opacity: disabled ? 0.5 : 1 },
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}>
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
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
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  label: {
    ...Typography.section,
    fontSize: 15,
  },
  right: {
    marginLeft: Spacing.xs,
  },
});

