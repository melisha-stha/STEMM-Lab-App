import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRAND = {
  purple: '#4A1B6D',
  purpleLight: '#7B3FA0',
  purpleSoft: '#F3E8FF',
  coral: '#E8756A',
  coralLight: '#F0A090',
  coralSoft: '#FEE2E2',
  gold: '#F0C040',
  goldSoft: '#FEF9C3',
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  textDark: '#1A1A2E',
  textMuted: '#6B7280',
};

const LOGO_SOURCE = require('@/assets/images/welcomelogo.png');
const WELCOME_TEXT_SOURCE = require('@/assets/images/welcometext.png');

const FEATURE_PILLS = [
  { label: 'Experiments', backgroundColor: BRAND.goldSoft, color: BRAND.purple },
  { label: 'Track Results', backgroundColor: BRAND.purpleSoft, color: BRAND.purple },
  { label: 'Leaderboard', backgroundColor: BRAND.coralSoft, color: BRAND.coral },
] as const;

const LOGO_SIZE = 360;
const HORIZONTAL_PADDING = 24;
const WELCOME_TEXT_WIDTH = Dimensions.get('window').width - HORIZONTAL_PADDING * 2;
const WELCOME_TEXT_HEIGHT = 188;

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [logoFailed, setLogoFailed] = useState(false);

  const background = useThemeColor({}, 'background');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const isDark = colorScheme === 'dark';
  const welcomeTitleColor = isDark ? BRAND.white : BRAND.purple;
  const welcomeMutedColor = isDark ? textSecondary : BRAND.textMuted;

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
              <Text style={[styles.slogan, { color: welcomeTitleColor }]}>learning made fun</Text>
            </View>
          </View>
        </View>

        <View style={[styles.bottomSection, { backgroundColor: background }]}>
          <View style={styles.pillsRow}>
            {FEATURE_PILLS.map((pill) => (
              <View
                key={pill.label}
                style={[styles.pill, { backgroundColor: pill.backgroundColor }]}>
                <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: BRAND.purple },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/signup')}>
            <Text style={[styles.primaryButtonText, { color: BRAND.white }]}>
              Create Team Account
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: BRAND.purpleSoft },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/login')}>
            <Text style={[styles.secondaryButtonText, { color: BRAND.purple }]}>Sign In</Text>
          </Pressable>

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
  screen: {
    flex: 1,
  },
  topSection: {
    flex: 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
    lineHeight: 28,
    letterSpacing: 0.4,
  },
  bottomSection: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 99,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
  },
});
