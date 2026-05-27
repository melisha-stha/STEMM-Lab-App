import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { usePanelFieldColors } from '@/components/ui/activity-color-panel';
import { FontWeight, Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type BaseProps = {
  index: number;
  isLast?: boolean;
};

type InlineProps = BaseProps & {
  value: string;
  title?: never;
  subtitle?: never;
};

type StackedProps = BaseProps & {
  title: string;
  subtitle: string;
  value?: never;
};

type Props = InlineProps | StackedProps;

export function AttemptRow(props: Props) {
  const { index, isLast } = props;
  const { foreground, muted, border, surface, onPanel } = usePanelFieldColors();
  const primary = useThemeColor({}, 'primary');

  if ('title' in props && props.title != null && props.subtitle != null) {
    return (
      <View
        style={[
          styles.stackedCard,
          {
            borderColor: border,
            backgroundColor: onPanel ? surface : 'transparent',
          },
          isLast ? styles.last : null,
        ]}>
        <Text style={[styles.stackedTitle, { color: foreground }]}>
          Attempt {index}: {props.title}
        </Text>
        <Text style={[styles.stackedSubtitle, { color: onPanel ? border : primary }]}>
          {props.subtitle}
        </Text>
      </View>
    );
  }

  const value = props.value ?? '';

  return (
    <View style={[styles.row, { borderBottomColor: border }, isLast ? styles.last : null]}>
      <Text style={[styles.left, { color: muted, opacity: onPanel ? 0.75 : 1 }]}>Attempt {index}</Text>
      <Text
        style={[styles.right, { color: onPanel ? border : primary }]}
        numberOfLines={2}
        ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  stackedCard: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  stackedTitle: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  stackedSubtitle: {
    ...Typography.section,
    fontSize: 15,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  last: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  left: {
    ...Typography.body,
    fontSize: 14,
    flexShrink: 0,
  },
  right: {
    ...Typography.section,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    flex: 1,
    textAlign: 'right',
  },
});
