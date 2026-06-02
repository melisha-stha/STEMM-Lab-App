import { useThemePreference } from '@/contexts/theme-preference';
import { Radius } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

const ICON_SIZE = 16;
const SEGMENT = 28;

type Props = {
  style?: ViewStyle;
};

export function ThemeModeToggle({ style }: Props) {
  const { colorScheme, setColorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';

  const toggleScheme = () => {
    setColorScheme(isDark ? 'light' : 'dark');
  };

  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const gold = useThemeColor({}, 'gold');
  const goldDark = useThemeColor({}, 'goldDark');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const onGold = useThemeColor({}, 'onGold');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary');
  const border = useThemeColor({}, 'border');

  return (
    <View style={style} pointerEvents="box-none">
      <View
        style={[
          styles.track,
          {
            backgroundColor: backgroundSecondary,
            borderColor: border,
          },
        ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Light mode"
        accessibilityState={{ selected: !isDark }}
        onPress={toggleScheme}
        style={({ pressed }) => [
          styles.segment,
          {
            backgroundColor: !isDark ? gold : 'transparent',
            borderColor: !isDark ? goldDark : 'transparent',
          },
          pressed && styles.pressed,
        ]}>
        <MaterialIcons name="wb-sunny" size={ICON_SIZE} color={!isDark ? onGold : primary} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dark mode"
        accessibilityState={{ selected: isDark }}
        onPress={toggleScheme}
        style={({ pressed }) => [
          styles.segment,
          {
            backgroundColor: isDark ? primary : 'transparent',
            borderColor: isDark ? primaryDark : 'transparent',
          },
          pressed && styles.pressed,
        ]}>
        <MaterialIcons name="dark-mode" size={ICON_SIZE} color={isDark ? onPrimary : primary} />
      </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
    padding: 2,
    gap: 2,
  },
  segment: {
    width: SEGMENT,
    height: SEGMENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
