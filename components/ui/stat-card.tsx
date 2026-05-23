import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card, type CardColour, useCardColours } from '@/components/ui/Card';
import { FontSize, FontWeight, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type StatCardProps = {
  label: string;
  value: string | number;
  colour?: CardColour;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

export function StatCard({ label, value, colour = 'lavender', icon }: StatCardProps) {
  const { textColor } = useCardColours(colour);
  const textSecondary = useThemeColor({}, 'textSecondary');

  return (
    <Card colour={colour} style={styles.card}>
      {icon ? (
        <MaterialIcons name={icon} size={22} color={textColor} accessibilityElementsHidden />
      ) : null}
      <Text style={[styles.value, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    gap: Spacing.xs,
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
