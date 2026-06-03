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
import { getTeamData, saveReactionResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ParsedReactionAttempt {
  phase: number;
  reactionTime: number;
  tooEarly: boolean;
  accuracyPercent: number | null;
}

const REACTION_FAST_MS = 300;
const REACTION_SLOW_MS = 500;
const COLOR_REACTION_FAST = '#2E7D32';
const COLOR_REACTION_MID = '#F57F17';
const COLOR_REACTION_SLOW = '#C62828';

const getReactionColor = (ms: number): string => {
  if (ms < REACTION_FAST_MS) return COLOR_REACTION_FAST;
  if (ms <= REACTION_SLOW_MS) return COLOR_REACTION_MID;
  return COLOR_REACTION_SLOW;
};

const parseAttempts = (attemptsJson: string | string[] | undefined): ParsedReactionAttempt[] => {
  if (!attemptsJson || Array.isArray(attemptsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(attemptsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is ParsedReactionAttempt =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ParsedReactionAttempt).phase === 'number' &&
        typeof (item as ParsedReactionAttempt).reactionTime === 'number'
    );
  } catch {
    return [];
  }
};

export default function ReactionResultsScreen() {
  const router = useRouter();
  const { attemptsJson } = useLocalSearchParams<{ attemptsJson?: string }>();

  const attempts = useMemo(() => parseAttempts(attemptsJson), [attemptsJson]);

  const avgPhase1 = useMemo(() => {
    const match = attempts.find(a => a.phase === 1);
    return match ? match.reactionTime : null;
  }, [attempts]);

  const avgPhase2 = useMemo(() => {
    const match = attempts.find(a => a.phase === 2);
    return match ? match.reactionTime : null;
  }, [attempts]);

  const phase3Metrics = useMemo(() => {
    const match = attempts.find(a => a.phase === 3);
    return match ? { lagMs: match.reactionTime, accuracy: match.accuracyPercent } : null;
  }, [attempts]);

  const handDiff = useMemo(() => {
    if (avgPhase1 !== null && avgPhase2 !== null) {
      return avgPhase2 - avgPhase1;
    }
    return null;
  }, [avgPhase1, avgPhase2]);

  const bestTappingScore = useMemo(() => {
    const scores = [avgPhase1, avgPhase2].filter((v): v is number => v !== null);
    return scores.length ? Math.min(...scores) : null;
  }, [avgPhase1, avgPhase2]);

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const { scrollContentStyle } = useScreenScrollInsets();

  const handleSubmit = async (): Promise<void> => {
    if (!attempts.length) {
      Alert.alert('No attempts', 'Please record at least one trial before submitting.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Add a reflection', 'Write a short note about what improved your reaction time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      const payloadAttempts = attempts.map(a => ({
        phase: a.phase,
        reactionTime: a.reactionTime,
        tooEarly: a.tooEarly,
      }));

      await saveReactionResults({
        activity: 'reaction',
        createdAt: Date.now(),
        attempts: payloadAttempts,
        avgPhase1ReactionTime: avgPhase1,
        avgPhase2ReactionTime: avgPhase2,
        avgPhase3ReactionTime: phase3Metrics?.lagMs ?? null,
        bestReactionTime: bestTappingScore,
        comment: reflection.trim(),
        teamName: team?.name ?? '—',
        teamId: team?.id ?? null,
        grade: team?.grade ?? '—',
      });
      Alert.alert('Saved', 'Reflection saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Storage Error', 'Could not commit results to local storage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, scrollContentStyle]}>
        <ScreenBackButton />
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Reaction Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review your phase results and submit your reflection.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Summary</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No attempts were provided. Go back and complete the activity first.
          </Text>
        ) : (
          <View style={[styles.summaryList, { borderTopColor: border }]}>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Phase 1 Average (Dominant)</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {avgPhase1 !== null ? `${avgPhase1} ms` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Phase 2 Average (Non Dominant)</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {avgPhase2 !== null ? `${avgPhase2} ms` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Phase 3 Tracking Metrics</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {phase3Metrics !== null ? `${phase3Metrics.accuracy}% accuracy · ${phase3Metrics.lagMs}ms lag` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>
                Dominant vs Non Dominant Delta
              </Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {handDiff !== null ? `${handDiff > 0 ? '+' : ''}${handDiff} ms` : '—'}
              </Text>
            </View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: card, borderColor: bestTappingScore !== null ? success : border },
              ]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Best Tapping Reaction Speed</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: bestTappingScore !== null ? getReactionColor(bestTappingScore) : text },
                ]}>
                {bestTappingScore !== null ? `${bestTappingScore} ms` : '—'}
              </Text>
            </View>
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Reflection</Text>
        <Text style={[styles.help, { color: mutedText }]}>
          What helped you react faster across the three phases?
        </Text>
        <Input
          label="Comment"
          placeholder="e.g. predicting the next button position improved my phase 3 time"
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
          label="View leaderboard"
          variant="secondary"
          onPress={() => router.push('/leaderboard')}
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
    gap: 4,
  },
  summaryLabel: { ...Typography.small, fontWeight: '700' },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  help: { ...Typography.body, fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
  reflectionInput: {
    minHeight: 120,
    paddingTop: Spacing.sm,
  },
  actions: { gap: Spacing.sm },
});