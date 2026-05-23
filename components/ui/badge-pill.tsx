import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  label: string;
  tone?: 'default' | 'engineering' | 'health' | 'muted';
};

export function BadgePill({ label, tone = 'default' }: Props) {
  const border = useThemeColor({}, 'border');
  const mutedText = useThemeColor({}, 'mutedText');
  const text = useThemeColor({}, 'text');
  const engineeringSoft = useThemeColor({}, 'engineeringSoft');
  const healthSoft = useThemeColor({}, 'healthSoft');
  const card = useThemeColor({}, 'card');

  const bg =
    tone === 'engineering' ? engineeringSoft : tone === 'health' ? healthSoft : tone === 'muted' ? card : card;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.label, { color: tone === 'muted' ? mutedText : text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  label: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: '600',
  },
});
