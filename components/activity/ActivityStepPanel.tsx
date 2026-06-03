import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import { ColorPanel } from '@/components/ui/activity-color-panel';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type ActivityStepPanelVariant = 'stacked' | 'inline';

export type ActivityStepPanelProps = {
  step: number;
  title: string;
  colour?: ActivityCardColour;
  variant?: ActivityStepPanelVariant;
  children: React.ReactNode;
};

export function ActivityStepPanel({
  step,
  title,
  colour = 'lavender',
  variant = 'stacked',
  children,
}: ActivityStepPanelProps) {
  const { textColor, cardIconBg, borderColor } = useActivityCardColours(colour);
  const isInline = variant === 'inline';
  const badgeColor = isInline ? textColor : borderColor;

  return (
    <ColorPanel colour={colour}>
      <View style={isInline ? styles.stepHeaderInline : styles.stepHeaderStacked}>
        <View style={[isInline ? styles.stepBadgeInline : styles.stepBadgeStacked, { backgroundColor: cardIconBg }]}>
          <Text
            style={[
              isInline ? styles.stepBadgeTextInline : styles.stepBadgeTextStacked,
              { color: badgeColor },
            ]}>
            Step {step}
          </Text>
        </View>
        <Text style={[isInline ? styles.stepTitleInline : styles.stepTitleStacked, { color: textColor }]}>
          {title}
        </Text>
      </View>
      <View style={isInline ? styles.stepBodyInline : styles.stepBodyStacked}>{children}</View>
    </ColorPanel>
  );
}

const styles = StyleSheet.create({
  stepHeaderStacked: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  stepBadgeStacked: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  stepBadgeTextStacked: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  stepTitleStacked: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  stepBodyStacked: {
    gap: Spacing.md,
  },
  stepHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stepBadgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  stepBadgeTextInline: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stepTitleInline: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  stepBodyInline: {
    gap: Spacing.sm,
  },
});
