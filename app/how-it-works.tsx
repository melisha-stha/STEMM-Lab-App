import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useScreenScrollInsets } from '@/hooks/use-screen-scroll-insets';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STEPS = [
  {
    icon: 'category' as const,
    title: 'Choose a stream',
    body: 'Pick Engineering or Health and Medical Sciences.',
  },
  {
    icon: 'assignment' as const,
    title: 'Select a challenge',
    body: 'Each activity has instructions, tools, and reflection prompts.',
  },
  {
    icon: 'videocam' as const,
    title: 'Run the experiment',
    body: 'Use real materials and phone features like camera, GPS, sensors, and timers.',
  },
  {
    icon: 'replay' as const,
    title: 'Record attempts',
    body: 'Save multiple trials so your team can compare results.',
  },
  {
    icon: 'insights' as const,
    title: 'Check results',
    body: 'Review your best attempt, notes, and synced data.',
  },
  {
    icon: 'auto-awesome' as const,
    title: 'Improve and reflect',
    body: 'Use evidence to explain what changed and what worked better.',
  },
];

export default function HowItWorksScreen() {
  const router = useRouter();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const primary = useThemeColor({}, 'primary');
  const engineeringSoft = useThemeColor({}, 'engineeringSoft' as any) ?? 'rgba(0, 122, 255, 0.08)';
  const { scrollContentStyle } = useScreenScrollInsets();

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, scrollContentStyle]}>
        <ScreenBackButton />

      <Text style={[styles.title, { color: text }]}>How STEMM Lab Works</Text>

      {STEPS.map((step, index) => (
        <SectionCard key={step.title}>
          <View style={styles.stepRow}>
            <View style={[styles.stepIcon, { backgroundColor: engineeringSoft }]}>
              <MaterialIcons name={step.icon} size={22} color={primary} />
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: text }]}>
                {index + 1}. {step.title}
              </Text>
              <Text style={[styles.stepBody, { color: mutedText }]}>{step.body}</Text>
            </View>
          </View>
        </SectionCard>
      ))}

      <PrimaryButton label="Got it" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
  title: {
    ...Typography.hero,
    fontSize: 26,
    marginBottom: Spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: Spacing.xs,
  },
  stepTitle: {
    ...Typography.section,
    fontSize: 15,
  },
  stepBody: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
