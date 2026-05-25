import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
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

const LOGO_SOURCE = require('@/assets/images/logo.png');

const FEATURE_PILLS = [
  { label: '🔬 Experiments', backgroundColor: BRAND.goldSoft, color: BRAND.purple },
  { label: '📊 Track Results', backgroundColor: BRAND.purpleSoft, color: BRAND.purple },
  { label: '🏆 Leaderboard', backgroundColor: BRAND.coralSoft, color: BRAND.coral },
] as const;

const LOGO_SIZE = 220;

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
          <View style={styles.logoRow}>
            <View style={[styles.goldLine, { backgroundColor: BRAND.gold }]} />
            <View style={styles.logoWrap}>
              {logoFailed ? (
                <View style={styles.logoFallback}>
                  <MaterialIcons name="science" size={80} color={BRAND.coral} />
                  <Text style={[styles.logoLine, { color: welcomeTitleColor }]}>STEMM</Text>
                  <Text style={[styles.logoLine, { color: welcomeTitleColor }]}>LAB</Text>
                </View>
              ) : (
                <Image
                  source={LOGO_SOURCE}
                  style={styles.logoImage}
                  contentFit="contain"
                  accessibilityLabel="STEMM Lab logo"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </View>
            <View style={[styles.goldLine, { backgroundColor: BRAND.gold }]} />
          </View>

          <Text style={[styles.welcomePrefix, { color: welcomeMutedColor }]}>Welcome to</Text>
          <Text style={[styles.welcomeTitle, { color: welcomeTitleColor }]}>STEMM Lab</Text>
          <Text style={[styles.welcomeSubtitle, { color: welcomeMutedColor }]}>
            Explore science through hands-on experiments
          </Text>
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
              { backgroundColor: BRAND.purple, borderLeftColor: BRAND.gold },
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 340,
  },
  goldLine: {
    width: 48,
    height: 2,
    flexShrink: 0,
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
  welcomePrefix: {
    fontSize: 16,
    fontWeight: '400',
    marginTop: 28,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  welcomeSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
    lineHeight: 22,
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
    gap: 8,
    marginBottom: 32,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderLeftWidth: 4,
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
