import { resolveAppRoute } from '@/hooks/app-routing';
import { auth } from '@/hooks/firebaseConfig';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export default function WelcomeScreen() {
  const router = useRouter();
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const destination = await resolveAppRoute(true);
      if (destination !== '/welcome-screen') {
        router.replace(destination);
      }
    });
    return unsubscribe;
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.gradientTop} />
      <View style={styles.screen}>
        <View style={styles.topSection}>
          <View style={styles.logoRow}>
            <View style={[styles.goldLine, { backgroundColor: BRAND.gold }]} />
            <View style={styles.logoCard}>
              {logoFailed ? (
                <View style={styles.logoFallback}>
                  <MaterialIcons name="science" size={64} color={BRAND.coral} />
                  <Text style={[styles.logoLine, { color: BRAND.purple }]}>STEMM</Text>
                  <Text style={[styles.logoLine, { color: BRAND.purple }]}>LAB</Text>
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

          <Text style={[styles.welcomePrefix, { color: BRAND.textMuted }]}>Welcome to</Text>
          <Text style={[styles.welcomeTitle, { color: BRAND.purple }]}>STEMM Lab</Text>
          <Text style={[styles.welcomeSubtitle, { color: BRAND.textMuted }]}>
            Explore science through hands-on experiments
          </Text>
        </View>

        <View style={styles.bottomSection}>
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

          <Text style={[styles.footer, { color: BRAND.textMuted }]}>
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
    backgroundColor: BRAND.white,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: BRAND.purpleSoft,
  },
  screen: {
    flex: 1,
  },
  topSection: {
    flex: 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  goldLine: {
    width: 60,
    height: 2,
  },
  logoCard: {
    width: 140,
    height: 140,
    borderRadius: 24,
    backgroundColor: BRAND.white,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: BRAND.textDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  logoImage: {
    width: 116,
    height: 116,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLine: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  welcomePrefix: {
    fontSize: 16,
    fontWeight: '400',
    marginTop: 32,
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
    backgroundColor: BRAND.white,
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
