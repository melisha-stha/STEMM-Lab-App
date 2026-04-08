import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  index: number;
  value: string;
  isLast?: boolean;
};

export function AttemptRow({ index, value, isLast }: Props) {
  const border = useThemeColor({}, 'border');
  const mutedText = useThemeColor({}, 'mutedText');
  const primary = useThemeColor({}, 'primary');

  return (
    <View style={[styles.row, { borderBottomColor: border }, isLast ? styles.last : null]}>
      <Text style={[styles.left, { color: mutedText }]}>Attempt {index}</Text>
      <Text style={[styles.right, { color: primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  last: {
    borderBottomWidth: 0,
  },
  left: {
    ...Typography.body,
    fontSize: 14,
  },
  right: {
    ...Typography.section,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});

