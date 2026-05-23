import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Shadow, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  subtitle: string;
  activitiesPreview: string;
  accentColor: string;
  softBackground: string;
  buttonLabel: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export function StreamCard({
  title,
  subtitle,
  activitiesPreview,
  accentColor,
  softBackground,
  buttonLabel,
  icon,
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
        { backgroundColor: softBackground, borderColor: border },
        Shadow.md,
        pressed ? styles.pressed : null,
      ]}>
      <View style={[styles.accentOrb, { backgroundColor: accentColor + '33' }]} />
      <View style={[styles.iconWrap, { backgroundColor: card }]}>
        <MaterialIcons name={icon} size={28} color={accentColor} />
      </View>
      <Text style={[styles.title, { color: text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: mutedText }]}>{subtitle}</Text>
      <Text style={[styles.preview, { color: mutedText }]}>{activitiesPreview}</Text>
      <View style={[styles.cta, { backgroundColor: accentColor }]}>
        <Text style={styles.ctaText}>{buttonLabel}</Text>
        <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
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
    minHeight: 200,
  },
  pressed: {
    opacity: 0.95,
  },
  accentOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -30,
    right: -20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.title,
    fontSize: 20,
  },
  subtitle: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  preview: {
    ...Typography.small,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  cta: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  ctaText: {
    ...Typography.section,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
