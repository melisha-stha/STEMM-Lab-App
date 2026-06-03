import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';

import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = ViewProps & {
  label: string;
  value: string;
  /** Use on light pastel cards (dark mode keeps card backgrounds light). */
  labelColor?: string;
  valueColor?: string;
  borderColor?: string;
};

export function InfoRow({
  label,
  value,
  style,
  labelColor,
  valueColor,
  borderColor: borderColorProp,
  ...rest
}: Props) {
  const themeBorder = useThemeColor({}, 'border');
  const themeMuted = useThemeColor({}, 'mutedText');
  const themeText = useThemeColor({}, 'text');
  const borderColor = borderColorProp ?? themeBorder;
  const labelInk = labelColor ?? themeMuted;
  const valueInk = valueColor ?? themeText;

  return (
    <View style={[styles.row, { borderTopColor: borderColor }, style]} {...rest}>
      <Text style={[styles.label, { color: labelInk, opacity: labelColor ? 0.78 : 1 }]}>{label}</Text>
      <Text style={[styles.value, { color: valueInk }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  label: {
    ...Typography.small,
    fontSize: 13,
  },
  value: {
    ...Typography.small,
    fontSize: 13,
    fontWeight: '600',
  },
});

