import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import type { ReactionAttempt } from '@/hooks/firestore';
import { getTeamData, saveReactionResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

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

const parseAttempts = (attemptsJson: string | string[] | undefined): ReactionAttempt[] => {
  if (!attemptsJson || Array.isArray(attemptsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(attemptsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is ReactionAttempt =>
        typeof item === 'object' &&
        item !== null &&
        (item.phase === 1 || item.phase === 2 || item.phase === 3)
    );
  } catch {
    return [];
  }
};

const averageReactionTime = (items: ReactionAttempt[], phase: 1 | 2 | 3): number | null => {
  const times = items
    .filter((a) => a.phase === phase && !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  if (!times.length) return null;
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
};

const bestReactionTime = (items: ReactionAttempt[]): number | null => {
  const times = items
    .filter((a) => !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  return times.length ? Math.min(...times) : null;
};

export default function ReactionResultsScreen() {
  const router = useRouter();
  const { attemptsJson } = useLocalSearchParams<{ attemptsJson?: string }>();

  const attempts = useMemo(() => parseAttempts(attemptsJson), [attemptsJson]);
  const avgPhase1 = useMemo(() => averageReactionTime(attempts, 1), [attempts]);
  const avgPhase2 = useMemo(() => averageReactionTime(attempts, 2), [attempts]);
  const avgPhase3 = useMemo(() => averageReactionTime(attempts, 3), [attempts]);
  const best = useMemo(() => bestReactionTime(attempts), [attempts]);
  const handDiff =
    avgPhase1 != null && avgPhase2 != null ? avgPhase2 - avgPhase1 : null;

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
      Alert.alert('Add a reflection', 'Write a short note about what improved your reaction time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      await saveReactionResults({
        activity: 'reaction',
        createdAt: Date.now(),
        attempts,
        avgPhase1ReactionTime: avgPhase1,
        avgPhase2ReactionTime: avgPhase2,
        avgPhase3ReactionTime: avgPhase3,
        bestReactionTime: best,
        comment: reflection.trim(),
        teamName: team?.name ?? '—',
        teamId: team?.id ?? null,
        grade: team?.grade ?? '—',
      });
      router.replace('/leaderboard');
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
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Phase 1 average</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {avgPhase1 != null ? `${avgPhase1} ms` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Phase 2 average</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {avgPhase2 != null ? `${avgPhase2} ms` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Phase 3 average</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {avgPhase3 != null ? `${avgPhase3} ms` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>
                Dominant vs non-dominant
              </Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {handDiff != null ? `${handDiff > 0 ? '+' : ''}${handDiff} ms` : '—'}
              </Text>
            </View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: card, borderColor: best != null ? success : border },
              ]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Best reaction time</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: best != null ? getReactionColor(best) : text },
                ]}>
                {best != null ? `${best} ms` : '—'}
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
