import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeading({ title, subtitle, action }: SectionHeadingProps) {
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const primary = useThemeColor({}, 'primary');

  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: primary }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  action: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
