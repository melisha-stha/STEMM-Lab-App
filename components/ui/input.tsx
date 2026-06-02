import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { usePanelFieldColors } from '@/components/ui/activity-color-panel';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  showPasswordToggle?: boolean;
};

export function Input({ label, hint, error, style, ...rest }: Props) {
  const { foreground, muted, surface, border, onPanel } = usePanelFieldColors();
  const themeMuted = useThemeColor({}, 'mutedText');
  const danger = useThemeColor({}, 'danger');

  const borderColor = error ? danger : border;
  const placeholderColor = onPanel ? `${muted}99` : themeMuted;
  const shouldShowToggle = Boolean(rest.secureTextEntry && rest.showPasswordToggle);
  const [passwordHidden, setPasswordHidden] = useState(Boolean(rest.secureTextEntry));
  const effectiveSecure = useMemo(() => {
    if (!rest.secureTextEntry) return false;
    if (!shouldShowToggle) return true;
    return passwordHidden;
  }, [passwordHidden, rest.secureTextEntry, shouldShowToggle]);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: foreground }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: surface,
            borderColor,
          },
        ]}>
        <TextInput
          placeholderTextColor={onPanel ? `${muted}99` : placeholderColor}
          style={[
            styles.input,
            styles.inputFlex,
            {
              color: foreground,
              borderColor: 'transparent',
              backgroundColor: 'transparent',
            },
            shouldShowToggle && styles.inputWithEye,
            style,
          ]}
          {...rest}
          secureTextEntry={effectiveSecure}
        />
        {shouldShowToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            onPress={() => setPasswordHidden((v) => !v)}
            style={styles.eyeBtn}>
            <MaterialIcons
              name={passwordHidden ? 'visibility-off' : 'visibility'}
              size={20}
              color={onPanel ? foreground : themeMuted}
            />
          </Pressable>
        ) : null}
      </View>
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
  inputRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingRight: Spacing.sm,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    fontSize: 14,
  },
  inputFlex: {
    flex: 1,
    minHeight: 48,
  },
  inputWithEye: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  hint: {
    ...Typography.small,
  },
});

