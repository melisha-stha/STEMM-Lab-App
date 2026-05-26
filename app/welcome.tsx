import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary' as any) ?? '#6E6E73';  const primary = useThemeColor({}, 'primary');
  const textInverse = useThemeColor({}, 'textInverse' as any) ?? '#FFFFFF';
  const cardLavender = useThemeColor({}, 'cardLavender' as any) ?? '#E8E7FA';
  const cardMint = useThemeColor({}, 'cardMint' as any) ?? '#E2F4EE';
  const cardSky = useThemeColor({}, 'cardSky' as any) ?? '#E1F5FE';
  const cardYellow = useThemeColor({}, 'cardYellow' as any) ?? '#FFF6D6';

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
      ]}>
      <Text style={[styles.hero, { color: text }]}>STEMM Lab</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>
        Real-world science challenges for curious teams
      </Text>
      <Text style={[styles.body, { color: textSecondary }]}>
        Build, test, measure, and improve through hands-on STEMM activities using your phone.
      </Text>

      <Card colour="white" style={styles.visualCard}>
        <View style={styles.iconRow}>
          <View style={[styles.iconBubble, { backgroundColor: cardLavender }]}>
            <Text style={styles.emoji}>🔬</Text>
          </View>
          <View style={[styles.iconBubble, { backgroundColor: cardMint }]}>
            <Text style={styles.emoji}>📱</Text>
          </View>
          <View style={[styles.iconBubble, { backgroundColor: cardSky }]}>
            <Text style={styles.emoji}>🪂</Text>
          </View>
          <View style={[styles.iconBubble, { backgroundColor: cardYellow }]}>
            <Text style={styles.emoji}>💨</Text>
          </View>
        </View>
        <Text style={[styles.visualCaption, { color: textSecondary }]}>
          Film drops, measure sound, test structures, and explore how your body moves.
        </Text>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/setup-level' as Href)}
        style={[styles.primaryBtn, { backgroundColor: primary }]}>
        <Text style={[styles.primaryBtnText, { color: textInverse }]}>Start Lab Setup</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/login')}
        style={styles.secondaryLink}>
        <Text style={[styles.secondaryText, { color: textSecondary }]}>I already have a team</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    lineHeight: 24,
  },
  body: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
  },
  visualCard: {
    marginTop: Spacing.sm,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  visualCaption: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 19,
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  secondaryLink: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
