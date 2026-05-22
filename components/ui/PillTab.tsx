import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type PillTabProps = {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
};

export function PillTab({ tabs, activeIndex, onChange }: PillTabProps) {
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const textInverse = useThemeColor({}, 'textInverse');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {tabs.map((tab, index) => {
        const isActive = activeIndex === index;
        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(index)}
            style={[
              styles.pill,
              { backgroundColor: isActive ? primary : primarySoft },
            ]}>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? textInverse : primary,
                  fontWeight: isActive ? FontWeight.semibold : FontWeight.medium,
                },
              ]}
              numberOfLines={1}>
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.sm,
  },
});
