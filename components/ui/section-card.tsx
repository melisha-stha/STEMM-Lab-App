import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Radius, Shadow, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = ViewProps & {
  inset?: boolean;
};

export function SectionCard({ style, inset = false, ...rest }: Props) {
  const backgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View
      style={[
        styles.base,
        inset ? styles.inset : null,
        { backgroundColor, borderColor },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow,
  },
  inset: {
    padding: Spacing.sm,
  },
});

