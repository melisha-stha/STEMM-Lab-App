import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { usePanelFieldColors } from '@/components/ui/activity-color-panel';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, style, ...rest }: Props) {
  const { foreground, muted, surface, border, onPanel } = usePanelFieldColors();
  const themeMuted = useThemeColor({}, 'mutedText');
  const danger = useThemeColor({}, 'danger');

  const borderColor = error ? danger : border;
  const placeholderColor = onPanel ? `${muted}99` : themeMuted;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: foreground }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={onPanel ? `${muted}99` : placeholderColor}
        style={[
          styles.input,
          {
            color: foreground,
            backgroundColor: surface,
            borderColor,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.hint, { color: danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: muted, opacity: onPanel ? 0.75 : 1 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.small,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    fontSize: 14,
  },
  hint: {
    ...Typography.small,
  },
});

