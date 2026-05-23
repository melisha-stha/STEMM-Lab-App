import { ActivityCard } from '@/components/ui/activity-card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StreamsTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + SCREEN_BOTTOM_INSET,
        },
      ]}>
      <SectionHeading
        title="Streams"
        subtitle="Pick a subject area to see all challenges in that stream"
      />

      <ActivityCard
        title="Engineering Challenges"
        subtitle="Build, test, and improve real designs"
        colour="mint"
        badge="4 activities"
        onPress={() => router.push('/engineering' as Href)}
      />

      <ActivityCard
        title="Health and Medical Sciences"
        subtitle="Explore movement, reaction, and breathing"
        colour="sky"
        badge="3 activities"
        onPress={() => router.push('/health' as Href)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
});
