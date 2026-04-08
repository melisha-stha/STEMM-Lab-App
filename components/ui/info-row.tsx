import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';

import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = ViewProps & {
  label: string;
  value: string;
};

export function InfoRow({ label, value, style, ...rest }: Props) {
  const borderColor = useThemeColor({}, 'border');
  const mutedText = useThemeColor({}, 'mutedText');
  const text = useThemeColor({}, 'text');

  return (
    <View style={[styles.row, { borderTopColor: borderColor }, style]} {...rest}>
      <Text style={[styles.label, { color: mutedText }]}>{label}</Text>
      <Text style={[styles.value, { color: text }]} numberOfLines={1}>
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

