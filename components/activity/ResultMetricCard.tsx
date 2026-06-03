import { usePanelTheme } from '@/components/ui/activity-color-panel';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type ResultMetricCardProps = {
  title: string;
  primaryLine: string;
  primaryColor: string;
  sublines?: string[];
  sublineColor?: string;
  badgeLabel: string;
  badgeBorderColor: string;
  highlighted?: boolean;
  cardBorderColor?: string;
};

export function ResultMetricCard({
  title,
  primaryLine,
  primaryColor,
  sublines = [],
  sublineColor,
  badgeLabel,
  badgeBorderColor,
  highlighted = false,
  cardBorderColor,
}: ResultMetricCardProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const resolvedBorder = highlighted ? badgeBorderColor : (cardBorderColor ?? borderColor);
  const resolvedSublineColor = sublineColor ?? borderColor;

  return (
    <View
      style={[
        styles.measureRow,
        {
          borderColor: resolvedBorder,
          backgroundColor: cardIconBg,
        },
      ]}>
      <View style={styles.measureRowMain}>
        <Text style={[styles.measureAction, { color: textColor }]}>{title}</Text>
        <Text style={[styles.measureDb, { color: primaryColor }]}>{primaryLine}</Text>
        {sublines.map((line) => (
          <Text key={line} style={[styles.measureSubline, { color: resolvedSublineColor }]}>
            {line}
          </Text>
        ))}
      </View>
      <View style={[styles.riskBadge, { backgroundColor: cardIconBg, borderColor: badgeBorderColor }]}>
        <Text style={[styles.riskLabel, { color: badgeBorderColor }]}>{badgeLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  measureRow: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  measureRowMain: {
    flex: 1,
    gap: 2,
  },
  measureAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  measureDb: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  measureSubline: {
    fontSize: FontSize.xs,
    lineHeight: 17,
  },
  riskBadge: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  riskLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});
