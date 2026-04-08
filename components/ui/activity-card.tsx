import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  tag: string;
  description: string;
  cta?: string;
  onPress?: () => void;
};

export function ActivityCard({ title, tag, description, cta = 'Open activity', onPress }: Props) {
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const primary = useThemeColor({}, 'primary');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: surface, borderColor: border },
        pressed ? styles.pressed : null,
      ]}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.tag, { color: mutedText }]} numberOfLines={1}>
          {tag}
        </Text>
      </View>
      <Text style={[styles.body, { color: mutedText }]}>{description}</Text>
      <Text style={[styles.cta, { color: primary }]}>{cta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    alignItems: 'baseline',
  },
  title: {
    ...Typography.section,
    fontSize: 15,
    flex: 1,
  },
  tag: {
    ...Typography.small,
  },
  body: {
    marginTop: Spacing.sm,
    ...Typography.body,
  },
  cta: {
    marginTop: Spacing.sm,
    ...Typography.section,
    fontSize: 13,
  },
});

