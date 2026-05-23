import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Radius, Shadow, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

export type CardColour = 'mint' | 'lavender' | 'peach' | 'yellow' | 'sky' | 'pink' | 'white';

type CardProps = {
  children: React.ReactNode;
  colour?: CardColour;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
};

type ColourToken = 'cardMint' | 'cardMintText' | 'cardLavender' | 'cardLavenderText' | 'cardPeach' | 'cardPeachText' | 'cardYellow' | 'cardYellowText' | 'cardSky' | 'cardSkyText' | 'cardPink' | 'cardPinkText' | 'surface' | 'text';

const COLOUR_KEYS: Record<CardColour, { bg: ColourToken; text: ColourToken }> = {
  mint: { bg: 'cardMint', text: 'cardMintText' },
  lavender: { bg: 'cardLavender', text: 'cardLavenderText' },
  peach: { bg: 'cardPeach', text: 'cardPeachText' },
  yellow: { bg: 'cardYellow', text: 'cardYellowText' },
  sky: { bg: 'cardSky', text: 'cardSkyText' },
  pink: { bg: 'cardPink', text: 'cardPinkText' },
  white: { bg: 'surface', text: 'text' },
};

export function useCardColours(colour: CardColour = 'white') {
  const keys = COLOUR_KEYS[colour];
  const backgroundColor = useThemeColor({}, keys.bg);
  const textColor = useThemeColor({}, keys.text);
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const shadowColor = useThemeColor({}, 'shadow');
  return { backgroundColor, textColor, border, primary, primarySoft, shadowColor };
}

export function Card({ children, colour = 'white', onPress, style, selected }: CardProps) {
  const { backgroundColor, border, primary, primarySoft, shadowColor } = useCardColours(colour);

  const cardStyle = [
    styles.card,
    Shadow.md,
    {
      backgroundColor: selected ? primarySoft : backgroundColor,
      borderColor: selected ? primary : border,
      borderWidth: selected ? 2 : 1,
      shadowColor,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed ? styles.pressed : null]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
});
