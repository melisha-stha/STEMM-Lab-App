import { ActivityCard } from '@/components/ui/activity-card';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FontSize, FontWeight, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHALLENGES = [
  {
    title: 'Human Performance Lab',
    route: '/performance' as const,
    subtitle: 'Measure movement control, speed, and smoothness.',
    colour: 'peach' as const,
    badge: 'Movement',
  },
  {
    title: 'Reaction Board Challenge',
    route: '/reaction' as Href,
    subtitle: 'Test reaction speed and coordination.',
    colour: 'yellow' as const,
    badge: 'Neuroscience',
  },
  {
    title: 'Breathing Pace Trainer',
    route: '/breathing' as Href,
    subtitle: 'Compare breathing patterns at rest and after exercise.',
    colour: 'sky' as const,
    badge: 'Health',
  },
];

export default function HealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const cardSkyText = useThemeColor({}, 'cardSkyText');

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl },
      ]}>
      <TouchableOpacity
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <Card colour="sky" style={styles.heroCard}>
        <Text style={[styles.heroTitle, { color: cardSkyText }]}>Welcome, Health Scientists</Text>
        <Text style={[styles.heroSubtitle, { color: textSecondary }]}>
          Explore how the body moves, reacts, and breathes through simple experiments.
        </Text>
        <Text style={[styles.heroBody, { color: textSecondary }]}>
          Health and Medical Sciences activities help your team investigate movement, coordination,
          reaction time, and breathing patterns.
        </Text>
      </Card>

      <SectionHeading title="Challenges" subtitle="Tap a card to start" />

      <View style={styles.list}>
        {CHALLENGES.map((challenge) => (
          <ActivityCard
            key={challenge.title}
            title={challenge.title}
            subtitle={challenge.subtitle}
            colour={challenge.colour}
            badge={challenge.badge}
            onPress={() => router.push(challenge.route as Href)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  heroCard: {
    gap: Spacing.sm,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
  },
  heroBody: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  list: {
    gap: Spacing.md,
  },
});
