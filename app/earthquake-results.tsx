import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { getTeamData, saveEarthquakeResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

interface EarthquakeAttempt {
  score: number;
  duration: number;
}

const getStabilityColor = (score: number): string => {
  if (score >= 70) return '#2E7D32';
  if (score >= 40) return '#F57F17';
  return '#C62828';
};

const getStabilityLabel = (score: number): string => {
  if (score >= 70) return 'Stable';
  if (score >= 40) return 'Moderate';
  return 'Unstable';
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

const parseAttempts = (attemptsJson: string | string[] | undefined): EarthquakeAttempt[] => {
  if (!attemptsJson || Array.isArray(attemptsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(attemptsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is EarthquakeAttempt =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as EarthquakeAttempt).score === 'number' &&
        typeof (item as EarthquakeAttempt).duration === 'number'
    );
  } catch {
    return [];
  }
};

export default function EarthquakeResultsScreen() {
  const router = useRouter();
  const { attemptsJson } = useLocalSearchParams<{ attemptsJson?: string }>();

  const attempts = useMemo(() => parseAttempts(attemptsJson), [attemptsJson]);
  const best = useMemo(
    () => (attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null),
    [attempts]
  );

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const success = useThemeColor({}, 'success');

  const handleSubmit = async (): Promise<void> => {
    if (!attempts.length) {
      Alert.alert('No attempts', 'Please record at least one trial before submitting.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Add a reflection', 'Write a short note about what kept your structure stable.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      await saveEarthquakeResults({
        activity: 'earthquake',
        createdAt: Date.now(),
        attempts,
        bestScore: best,
        comment: reflection.trim(),
        teamName: team?.name ?? '—',
        teamId: team?.id ?? null,
        grade: team?.grade ?? '—',
      });
      router.replace('/(tabs)');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Earthquake Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review your stability trials and submit your reflection.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Attempts</Text>

        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No trials were provided. Go back and record an attempt first.
          </Text>
        ) : (
          <View style={[styles.attemptsList, { borderTopColor: border }]}>
            {attempts.map((item, idx) => {
              const isBest = best !== null && item.score === best;
              const scoreColor = getStabilityColor(item.score);
              return (
                <View
                  key={`${idx}-${item.duration}`}
                  style={[
                    styles.attemptRowCard,
                    {
                      backgroundColor: card,
                      borderColor: isBest ? success : border,
                    },
                  ]}>
                  <View style={styles.attemptRowLeft}>
                    <Text style={[styles.attemptLabel, { color: mutedText }]}>Attempt {idx + 1}</Text>
                    <Text style={[styles.attemptValue, { color: scoreColor }]}>{item.score} pts</Text>
                    <Text style={[styles.attemptMeta, { color: mutedText }]}>
                      Duration: {formatTime(item.duration)}s · {getStabilityLabel(item.score)}
                    </Text>
                  </View>
                  {isBest ? (
                    <View style={[styles.badge, { backgroundColor: success }]}>
                      <Text style={[styles.badgeText, { color: '#071018' }]}>Best</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Reflection</Text>
        <Text style={[styles.help, { color: mutedText }]}>
          What design features helped your structure stay stable?
        </Text>
        <Input
          label="Comment"
          placeholder="e.g. wider base and cross-bracing reduced shaking"
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
          disabled={isSubmitting || attempts.length === 0 || reflection.trim().length === 0}
        />
        <PrimaryButton
          label="View on map"
          variant="secondary"
          onPress={() => router.push('/map')}
        />
        <PrimaryButton
          label="Back to dashboard"
          variant="secondary"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },

  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },

  attemptsList: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  attemptRowCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attemptRowLeft: { gap: 6, flex: 1 },
  attemptLabel: { ...Typography.small, fontWeight: '700' },
  attemptValue: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  attemptMeta: { ...Typography.small },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeText: { ...Typography.small, fontWeight: '800', letterSpacing: 0.2 },

  help: { ...Typography.body, fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
  reflectionInput: {
    minHeight: 120,
    paddingTop: Spacing.sm,
  },

  actions: { gap: Spacing.sm },
});
