import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, style, ...rest }: Props) {
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');

  const borderColor = error ? danger : border;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: text }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={mutedText}
        style={[
          styles.input,
          {
            color: text,
            backgroundColor: card,
            borderColor,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.hint, { color: danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: mutedText }]}>{hint}</Text>
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

