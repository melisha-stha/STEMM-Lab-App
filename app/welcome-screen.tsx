import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRAND = {
  purple: '#4A1B6D',
  purpleLight: '#7B3FA0',
  purpleSoft: '#F3E8FF',
  purpleBorder: '#2D1045',
  coral: '#E8756A',
  coralSoft: '#FEE2E2',
  coralBorder: '#9F3D36',
  gold: '#F0C040',
  goldSoft: '#FEF9C3',
  goldBorder: '#B8890A',
  white: '#FFFFFF',
  textDark: '#1A1A2E',
  textMuted: '#6B7280',
};

const LOGO_SOURCE = require('@/assets/images/welcomelogo.png');
const WELCOME_TEXT_SOURCE = require('@/assets/images/welcometext.png');

const FEATURE_PILLS = [
  {
    label: 'Experiments',
    backgroundColor: BRAND.goldSoft,
    color: BRAND.purple,
    borderColor: BRAND.goldBorder,
  },
  {
    label: 'Track Results',
    backgroundColor: BRAND.purpleSoft,
    color: BRAND.purple,
    borderColor: BRAND.purpleBorder,
  },
  {
    label: 'Leaderboard',
    backgroundColor: BRAND.coralSoft,
    color: '#7F1D1D',
    borderColor: BRAND.coralBorder,
  },
] as const;

const LOGO_SIZE = 360;
const HORIZONTAL_PADDING = 24;
const WELCOME_TEXT_WIDTH = Dimensions.get('window').width - HORIZONTAL_PADDING * 2;
const WELCOME_TEXT_HEIGHT = 188;

const PIXEL_RADIUS = 6;
const PIXEL_BORDER = 3;
const PIXEL_SHADOW = 4;

type PixelBoxProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  shadowColor: string;
};

function PixelBox({ children, style, shadowColor }: PixelBoxProps) {
  return (
    <View style={[styles.pixelBoxWrap, style]}>
      <View style={[styles.pixelBoxShadow, { backgroundColor: shadowColor }]} />
      {children}
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [logoFailed, setLogoFailed] = useState(false);
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();

  const background = useThemeColor({}, 'background');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const surface = useThemeColor({}, 'surface');
  const isDark = colorScheme === 'dark';
  const welcomeTitleColor = isDark ? BRAND.white : BRAND.purple;
  const welcomeMutedColor = isDark ? textSecondary : BRAND.textMuted;
  const pixelShadow = isDark ? '#000000' : BRAND.purpleBorder;

  const primaryBg = isDark ? BRAND.purpleLight : BRAND.purple;
  const primaryBorder = isDark ? '#000000' : BRAND.purpleBorder;
  const primaryText = BRAND.white;

  const secondaryBg = isDark ? surface : BRAND.purpleSoft;
  const secondaryBorder = isDark ? '#9CA3AF' : BRAND.purpleBorder;
  const secondaryText = isDark ? BRAND.white : BRAND.purple;

  if (!pixelFontLoaded) {
    return (
      <SafeAreaView style={[styles.safe, styles.loading, { backgroundColor: background }]}>
        <ActivityIndicator size="large" color={primaryBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top', 'bottom']}>
      <View style={[styles.screen, { backgroundColor: background }]}>
        <View style={styles.topSection}>
          <View style={styles.heroGroup}>
            <Image
              source={WELCOME_TEXT_SOURCE}
              style={styles.welcomeTextImage}
              contentFit="contain"
              accessibilityLabel="Welcome to"
              transition={0}
            />

            <View style={[styles.brandBlock, { width: LOGO_SIZE }]}>
              <View style={styles.logoWrap}>
                {logoFailed ? (
                  <View style={styles.logoFallback}>
                    <MaterialIcons name="science" size={96} color={BRAND.coral} />
                    <Text style={[styles.logoLine, { color: welcomeTitleColor }]}>STEMM</Text>
                    <Text style={[styles.logoLine, { color: welcomeTitleColor }]}>LAB</Text>
                  </View>
                ) : (
                  <Image
                    source={LOGO_SOURCE}
                    style={styles.logoImage}
                    contentFit="contain"
                    accessibilityLabel="STEMM Lab logo"
                    transition={0}
                    onError={() => setLogoFailed(true)}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.slogan,
                  { color: welcomeTitleColor, fontFamily: pixelFamily },
                ]}>
                learning made fun
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.bottomSection, { backgroundColor: background }]}>
          <View style={styles.pillsRow}>
            {FEATURE_PILLS.map((pill) => (
              <PixelBox key={pill.label} shadowColor={pixelShadow} style={styles.pillOuter}>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: pill.backgroundColor,
                      borderColor: pill.borderColor,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.pillText,
                      { color: pill.color, fontFamily: pixelFamily },
                    ]}>
                    {pill.label}
                  </Text>
                </View>
              </PixelBox>
            ))}
          </View>

          <PixelBox shadowColor={pixelShadow} style={styles.buttonOuter}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: primaryBg,
                  borderColor: primaryBorder,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push('/signup')}>
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: primaryText, fontFamily: pixelFamily },
                ]}>
                Create Team Account
              </Text>
            </Pressable>
          </PixelBox>

          <PixelBox shadowColor={pixelShadow} style={styles.buttonOuterLast}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: secondaryBg,
                  borderColor: secondaryBorder,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push('/login')}>
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: secondaryText, fontFamily: pixelFamily },
                ]}>
                Sign In
              </Text>
            </Pressable>
          </PixelBox>

          <Text style={[styles.footer, { color: welcomeMutedColor }]}>
            For school science programs
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
  },
  topSection: {
    flex: 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
  },
  heroGroup: {
    alignItems: 'center',
    gap: 0,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: -20,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logoLine: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  welcomeTextImage: {
    width: WELCOME_TEXT_WIDTH,
    height: WELCOME_TEXT_HEIGHT,
    marginTop: 4,
    marginBottom: -28,
  },
  slogan: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    width: '100%',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  bottomSection: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
    maxWidth: '100%',
  },
  pixelBoxWrap: {
    position: 'relative',
    paddingRight: PIXEL_SHADOW,
    paddingBottom: PIXEL_SHADOW,
  },
  pixelBoxShadow: {
    position: 'absolute',
    top: PIXEL_SHADOW,
    left: PIXEL_SHADOW,
    right: 0,
    bottom: 0,
    borderRadius: PIXEL_RADIUS,
  },
  pillOuter: {
    maxWidth: '100%',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: PIXEL_RADIUS,
    borderWidth: PIXEL_BORDER,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  pillText: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  buttonOuter: {
    width: '100%',
    marginBottom: 12,
  },
  buttonOuterLast: {
    width: '100%',
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: PIXEL_RADIUS + 2,
    borderWidth: PIXEL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: PIXEL_RADIUS + 2,
    borderWidth: PIXEL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  secondaryButtonText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
