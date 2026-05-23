import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgePill } from '@/components/ui/badge-pill';
import { Radius, Shadow, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  description: string;
  badges: string[];
  estimatedTime: string;
  difficulty: string;
  accentColor: string;
  onPress: () => void;
};

export function ChallengeCard({
  title,
  description,
  badges,
  estimatedTime,
  difficulty,
  accentColor,
  onPress,
}: Props) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: card, borderColor: border },
        Shadow.md,
        pressed ? styles.pressed : null,
      ]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <Text style={[styles.title, { color: text }]}>{title}</Text>
      <Text style={[styles.description, { color: mutedText }]}>{description}</Text>
      <View style={styles.badgeRow}>
        {badges.map((badge) => (
          <BadgePill key={badge} label={badge} tone="muted" />
        ))}
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="schedule" size={16} color={mutedText} />
          <Text style={[styles.metaText, { color: mutedText }]}>{estimatedTime}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialIcons name="signal-cellular-alt" size={16} color={mutedText} />
          <Text style={[styles.metaText, { color: mutedText }]}>{difficulty}</Text>
        </View>
      </View>
      <View style={[styles.startRow, { borderTopColor: border }]}>
        <Text style={[styles.startLabel, { color: accentColor }]}>Start challenge</Text>
        <MaterialIcons name="play-circle-filled" size={24} color={accentColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.95,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  title: {
    ...Typography.title,
    fontSize: 18,
    paddingLeft: Spacing.sm,
  },
  description: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.small,
    fontSize: 12,
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    paddingLeft: Spacing.sm,
  },
  startLabel: {
    ...Typography.section,
    fontSize: 14,
  },
});
