import { Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

type ScreenBackButtonProps = {
  onPress?: () => void;
  style?: ViewStyle;
};

/** Standard back control aligned below the status bar when used inside SafeAreaView. */
export function ScreenBackButton({ onPress, style }: ScreenBackButtonProps) {
  const router = useRouter();
  const text = useThemeColor({}, 'text');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress ?? (() => router.back())}
      style={[styles.button, style]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <MaterialIcons name="arrow-back" size={24} color={text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
