import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import type { BreathingSession } from '@/hooks/firestore';
import { getTeamData, saveBreathingResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

const SESSION_LABEL_REST = 'At Rest';
const SESSION_LABEL_EXERCISE_1 = 'After Exercise 1 — Jog 1 minute or 100 star jumps';
const SESSION_LABEL_EXERCISE_2 = 'After Exercise 2 — Repeat exercise';

const parseSessions = (sessionsJson: string | string[] | undefined): BreathingSession[] => {
  if (!sessionsJson || Array.isArray(sessionsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(sessionsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is BreathingSession =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as BreathingSession).label === 'string' &&
        typeof (item as BreathingSession).bpm === 'number' &&
        typeof (item as BreathingSession).duration === 'number'
    );
  } catch {
    return [];
  }
};

export default function BreathingResultsScreen() {
  const router = useRouter();
  const { sessionsJson } = useLocalSearchParams<{ sessionsJson?: string }>();

  const sessions = useMemo(() => parseSessions(sessionsJson), [sessionsJson]);
  const restingBpm = useMemo(
    () => sessions.find((s) => s.label === SESSION_LABEL_REST)?.bpm ?? null,
    [sessions]
  );
  const exercise1Bpm = useMemo(
    () => sessions.find((s) => s.label === SESSION_LABEL_EXERCISE_1)?.bpm ?? null,
    [sessions]
  );
  const exercise2Bpm = useMemo(
    () => sessions.find((s) => s.label === SESSION_LABEL_EXERCISE_2)?.bpm ?? null,
    [sessions]
  );
  const changeExercise1 =
    restingBpm != null && exercise1Bpm != null ? exercise1Bpm - restingBpm : null;
  const changeExercise2 =
    restingBpm != null && exercise2Bpm != null ? exercise2Bpm - restingBpm : null;

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');

  const handleSubmit = async (): Promise<void> => {
    if (sessions.length === 0) {
      Alert.alert('No sessions', 'Please complete all recording sessions before submitting.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Add a reflection', 'Write a short note about how exercise affected your breathing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      await saveBreathingResults({
        activity: 'breathing',
        createdAt: Date.now(),
        sessions,
        restingBpm,
        exercise1Bpm,
        exercise2Bpm,
        changeExercise1,
        changeExercise2,
        comment: reflection.trim(),
        teamName: team?.name ?? '—',
        teamId: team?.id ?? null,
        grade: team?.grade ?? '—',
      });
      Alert.alert('Saved', 'Reflection saved.', [{ text: 'OK', onPress: () => router.back() }]);
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
        <Text style={[styles.title, { color: text }]}>Breathing Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review your session results and submit your reflection.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Summary</Text>
        {sessions.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No sessions were provided. Go back and complete the activity first.
          </Text>
        ) : (
          <View style={[styles.summaryList, { borderTopColor: border }]}>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>At Rest</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {restingBpm != null ? `${restingBpm} BPM` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>After Exercise 1</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {exercise1Bpm != null ? `${exercise1Bpm} BPM` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>After Exercise 2</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {exercise2Bpm != null ? `${exercise2Bpm} BPM` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Change rest → exercise 1</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {changeExercise1 != null ? `${changeExercise1 > 0 ? '+' : ''}${changeExercise1} BPM` : '—'}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.summaryLabel, { color: mutedText }]}>Change rest → exercise 2</Text>
              <Text style={[styles.summaryValue, { color: text }]}>
                {changeExercise2 != null ? `${changeExercise2 > 0 ? '+' : ''}${changeExercise2} BPM` : '—'}
              </Text>
            </View>
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Reflection</Text>
        <Text style={[styles.help, { color: mutedText }]}>
          How did your breathing rate change after exercise?
        </Text>
        <Input
          label="Comment"
          placeholder="e.g. my BPM increased after star jumps because my body needed more oxygen"
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
          disabled={isSubmitting || sessions.length === 0 || reflection.trim().length === 0}
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
