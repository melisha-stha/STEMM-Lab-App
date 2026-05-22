import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, type CardColour, useCardColours } from '@/components/ui/Card';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type ActivityCardProps = {
  title: string;
  subtitle: string;
  colour: CardColour;
  onPress: () => void;
  badge?: string;
  completed?: boolean;
};

export function ActivityCard({
  title,
  subtitle,
  colour,
  onPress,
  badge,
  completed,
}: ActivityCardProps) {
  const { textColor } = useCardColours(colour);
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textTertiary = useThemeColor({}, 'textTertiary');
  const success = useThemeColor({}, 'success');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const primary = useThemeColor({}, 'primary');

  const titleColour = completed ? textTertiary : textColor;
  const subtitleColour = completed ? textTertiary : textSecondary;

  return (
    <Card
      colour={colour}
      onPress={onPress}
      style={completed ? [styles.wrap, styles.completed] : styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: titleColour }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: subtitleColour }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: primarySoft }]}>
            <Text style={[styles.badgeText, { color: primary }]}>{badge}</Text>
          </View>
        ) : null}
        {completed ? (
          <MaterialIcons name="check-circle" size={24} color={success} />
        ) : (
          <MaterialIcons name="chevron-right" size={28} color={textColor} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  completed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 20,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
