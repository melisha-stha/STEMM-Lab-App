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
    title: 'Parachute Drop Challenge',
    route: '/parachute' as const,
    subtitle: 'Design a parachute and test how safely it lands.',
    colour: 'mint' as const,
    badge: 'Physics',
  },
  {
    title: 'Sound Pollution Hunter',
    route: '/sound' as const,
    subtitle: 'Measure loud and quiet zones around your classroom.',
    colour: 'peach' as const,
    badge: 'Sound',
  },
  {
    title: 'Hand Fan Challenge',
    route: '/handfan' as const,
    subtitle: 'Test how air movement bends different materials.',
    colour: 'lavender' as const,
    badge: 'Forces',
  },
  {
    title: 'Earthquake-Resistant Structure',
    route: '/earthquake' as const,
    subtitle: 'Build a structure that reduces vibration.',
    colour: 'lavender' as const,
    badge: 'Sensors',
  },
];

export default function EngineeringScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const cardMintText = useThemeColor({}, 'cardMintText');

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

      <Card colour="mint" style={styles.heroCard}>
        <Text style={[styles.heroTitle, { color: cardMintText }]}>Welcome, Engineers</Text>
        <Text style={[styles.heroSubtitle, { color: textSecondary }]}>
          Build, test, measure, and improve designs using real-world experiments.
        </Text>
        <Text style={[styles.heroBody, { color: textSecondary }]}>
          Engineering challenges help your team test ideas, compare attempts, and improve designs
          using evidence.
        </Text>
      </Card>

      <SectionHeading title="Challenges" subtitle="Tap a card to start" />

      <View style={styles.list}>
        {CHALLENGES.map((challenge) => (
          <ActivityCard
            key={challenge.route}
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
