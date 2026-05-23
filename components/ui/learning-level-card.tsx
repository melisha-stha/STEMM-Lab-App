import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Shadow, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
  selected?: boolean;
  onPress: () => void;
};

export function LearningLevelCard({
  title,
  subtitle,
  description,
  icon,
  accentColor,
  selected,
  onPress,
}: Props) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: card,
          borderColor: selected ? accentColor : border,
          borderWidth: selected ? 2 : 1,
        },
        Shadow.md,
        pressed ? styles.pressed : null,
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
        <MaterialIcons name={icon} size={32} color={accentColor} />
      </View>
      <Text style={[styles.title, { color: text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: accentColor }]}>{subtitle}</Text>
      <Text style={[styles.description, { color: mutedText }]}>{description}</Text>
      {selected ? (
        <View style={[styles.selectedBadge, { backgroundColor: accentColor }]}>
          <MaterialIcons name="check" size={16} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 200,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.title,
    fontSize: 18,
  },
  subtitle: {
    ...Typography.section,
    fontSize: 14,
  },
  description: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.xs,
  },
  selectedBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
