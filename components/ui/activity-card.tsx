import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FontSize, FontWeight, Radius } from '@/constants/design';
import { Colors } from '@/constants/theme';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ActivityCardColour =
  | 'mint'
  | 'lavender'
  | 'peach'
  | 'yellow'
  | 'sky'
  | 'pink'
  | 'orange';

export type ActivityCardProps = {
  title: string;
  subtitle: string;
  colour: ActivityCardColour;
  badge: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  completed?: boolean;
  comingSoon?: boolean;
  onPress: () => void;
};

const COLOUR_TOKEN: Record<
  ActivityCardColour,
  { bg: keyof typeof Colors.light; border: keyof typeof Colors.light; shadow: keyof typeof Colors.light; text: keyof typeof Colors.light }
> = {
  mint: { bg: 'cardMint', border: 'cardMintBorder', shadow: 'cardMintShadow', text: 'cardMintText' },
  lavender: {
    bg: 'cardLavender',
    border: 'cardLavenderBorder',
    shadow: 'cardLavenderShadow',
    text: 'cardLavenderText',
  },
  peach: { bg: 'cardPeach', border: 'cardPeachBorder', shadow: 'cardPeachShadow', text: 'cardPeachText' },
  yellow: {
    bg: 'cardYellow',
    border: 'cardYellowBorder',
    shadow: 'cardYellowShadow',
    text: 'cardYellowText',
  },
  sky: { bg: 'cardSky', border: 'cardSkyBorder', shadow: 'cardSkyShadow', text: 'cardSkyText' },
  pink: { bg: 'cardPink', border: 'cardPinkBorder', shadow: 'cardPinkShadow', text: 'cardPinkText' },
  orange: {
    bg: 'cardOrange',
    border: 'cardOrangeBorder',
    shadow: 'cardOrangeShadow',
    text: 'cardOrangeText',
  },
};

const COMING_SOON_MESSAGE =
  'Coming Soon! This activity is being built. Check back soon!';

export function useActivityCardColours(colour: ActivityCardColour) {
  const keys = COLOUR_TOKEN[colour];
  const backgroundColor = useThemeColor({}, keys.bg);
  const borderColor = useThemeColor({}, keys.border);
  const shadowColor = useThemeColor({}, keys.shadow);
  const textColor = useThemeColor({}, keys.text);
  const cardIconBg = useThemeColor({}, 'cardIconBg');
  const cardIconBorder = useThemeColor({}, 'cardIconBorder');
  const cardBadgeBg = useThemeColor({}, 'cardBadgeBg');
  const success = useThemeColor({}, 'success');
  const onPrimary = useThemeColor({}, 'onPrimary');
  return {
    backgroundColor,
    borderColor,
    shadowColor,
    textColor,
    cardIconBg,
    cardIconBorder,
    cardBadgeBg,
    success,
    onPrimary,
  };
}

export function ActivityCard({
  title,
  subtitle,
  colour,
  badge,
  icon = 'science',
  completed = false,
  comingSoon = false,
  onPress,
}: ActivityCardProps) {
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const {
    backgroundColor,
    borderColor,
    shadowColor,
    textColor,
    cardIconBg,
    cardIconBorder,
    cardBadgeBg,
    success,
    onPrimary,
  } = useActivityCardColours(colour);

  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const animatePressIn = () => {
    setPressed(true);
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }),
      Animated.spring(translateY, { toValue: 2, useNativeDriver: true, friction: 8 }),
    ]).start();
  };

  const animatePressOut = () => {
    setPressed(false);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  };

  const handlePress = () => {
    if (comingSoon) {
      Alert.alert('Coming Soon', COMING_SOON_MESSAGE);
      return;
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
      <View
        style={[
          styles.outerCard,
          {
            borderColor,
            borderBottomColor: shadowColor,
            borderBottomWidth: pressed ? 0 : 4,
          },
        ]}>
        <Pressable
          accessibilityRole="button"
          onPress={handlePress}
          onPressIn={animatePressIn}
          onPressOut={animatePressOut}>
          <View style={[styles.innerCard, { backgroundColor }]}>
          <View style={[styles.iconTile, { backgroundColor: cardIconBg, borderColor: cardIconBorder }]}>
            <MaterialIcons name={icon} size={26} color={textColor} />
          </View>

          <View style={styles.middle}>
            {pixelFontLoaded ? (
              <Text
                style={[
                  styles.title,
                  { color: textColor, fontFamily: pixelFamily },
                  completed ? styles.titleCompleted : null,
                ]}
                numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            <Text style={[styles.subtitle, { color: textColor, opacity: 0.7 }]} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.right}>
            {completed ? (
              <View style={[styles.checkCircle, { backgroundColor: success }]}>
                <MaterialIcons name="check" size={16} color={onPrimary} />
              </View>
            ) : comingSoon ? (
              <View style={[styles.soonPill, { backgroundColor: cardBadgeBg }]}>
                <Text style={[styles.soonText, { color: textColor }]}>SOON</Text>
              </View>
            ) : (
              <>
                <View style={[styles.badgePill, { backgroundColor: cardBadgeBg }]}>
                  <Text style={[styles.badgeText, { color: textColor }]}>{badge}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={textColor} />
              </>
            )}
          </View>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerCard: {
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 2,
  },
  innerCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },
  titleCompleted: {
    opacity: 0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 52,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
