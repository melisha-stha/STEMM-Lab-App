import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useScreenScrollInsets } from '@/hooks/use-screen-scroll-insets';
import { getTeamData, saveSoundResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

interface SoundMeasurement {
  db: number;
  label: string;
}

const parseMeasurements = (measurementsJson: string | string[] | undefined): SoundMeasurement[] => {
  if (!measurementsJson || Array.isArray(measurementsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(measurementsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is SoundMeasurement =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SoundMeasurement).db === 'number' &&
        typeof (item as SoundMeasurement).label === 'string'
    );
  } catch {
    return [];
  }
};

function useDbRiskLevel(db: number) {
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const warning = useThemeColor({}, 'warning' as any) ?? '#FF9800';
  const error = useThemeColor({}, 'error' as any) ?? '#F44336';
  const text = useThemeColor({}, 'text');

  if (db < 30) return { label: 'No Risk', color: success };
  if (db < 60) return { label: 'Safe', color: success };
  if (db < 85) return { label: 'Long Exposure Risk', color: warning };
  if (db < 90) return { label: 'Hearing Damage Possible', color: warning };
  if (db < 100) return { label: 'Hearing Damage Likely', color: error };
  if (db < 110) return { label: 'Serious Damage', color: error };
  if (db < 120) return { label: 'Painful', color: error };
  if (db < 130) return { label: 'Severe Damage', color: text };
  return { label: 'Instant Permanent Damage', color: text };
}

export default function SoundResultsScreen() {
  const router = useRouter();
  const { measurementsJson } = useLocalSearchParams<{ measurementsJson?: string }>();

  const measurements = useMemo(() => parseMeasurements(measurementsJson), [measurementsJson]);
  const loudest = useMemo(() => {
    return measurements.length ? Math.max(...measurements.map((m) => m.db)) : null;
  }, [measurements]);

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const { scrollContentStyle } = useScreenScrollInsets();

  const handleSubmit = async (): Promise<void> => {
    if (!measurements.length) {
      Alert.alert('No measurements', 'Please record at least one measurement before submitting.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Add a reflection', 'Write a short note about your environmental noise findings.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      await saveSoundResults({
        activity: 'sound',
        createdAt: Date.now(),
        measurements,
        highestDb: loudest,
        comment: reflection.trim(),
        teamName: team?.name ?? '—',
        teamId: team?.id ?? null,
        grade: team?.grade ?? '—',
      });
      Alert.alert('Saved', 'Reflection saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Error', 'Could not save metrics to internal local device memory configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, scrollContentStyle]}>
        <ScreenBackButton />
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Sound Pollution Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review your classroom decibel readings and submit your reflection.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Captured Actions</Text>
        {measurements.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No measurements were provided. Go back and log actions first.
          </Text>
        ) : (
          <View style={[styles.summaryList, { borderTopColor: border }]}>
            {measurements.map((item, idx) => {
              const isPeak = loudest !== null && item.db === loudest;
              const risk = useDbRiskLevel(item.db);
              return (
                <View
                  key={`${idx}-${item.label}`}
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: card,
                      borderColor: isPeak ? risk.color : border,
                    },
                  ]}>
                  <View style={styles.cardLeft}>
                    <Text style={[styles.summaryLabel, { color: mutedText }]}>Action {idx + 1}: {item.label}</Text>
                    <Text style={[styles.summaryValue, { color: risk.color }]}>
                      {item.db} dB
                    </Text>
                    <Text style={[styles.summaryMeta, { color: mutedText }]}>
                      Status: {risk.label}
                    </Text>
                  </View>
                  {isPeak && (
                    <View style={[styles.peakBadge, { backgroundColor: risk.color }]}>
                      <Text style={styles.peakBadgeText}>Peak</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Reflection</Text>
        <Text style={[styles.help, { color: mutedText }]}>
          What structural variables or sound energy differences caused the highest volume reading?
        </Text>
        <Input
          label="Comment"
          placeholder="e.g. dropping the textbook produced a high peak because kinetic energy transferred directly into sound waves upon hitting the table surface"
          value={reflection}
          onChangeText={setReflection}
          multiline
          textAlignVertical="top"
          style={styles.reflectionInput}
        />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          label={isSubmitting ? 'Submitting…' : 'Submit Results'}
          onPress={() => void handleSubmit()}
          disabled={isSubmitting || measurements.length === 0 || reflection.trim().length === 0}
        />
        <PrimaryButton
          label="Back to dashboard"
          variant="secondary"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  summaryList: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.sm },
  summaryCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: { gap: 4, flex: 1 },
  summaryLabel: { ...Typography.small, fontWeight: '700' },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  summaryMeta: { fontSize: 11 },
  peakBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  peakBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  help: { ...Typography.body, fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
  reflectionInput: { minHeight: 120, paddingTop: Spacing.sm },
  actions: { gap: Spacing.sm },
});