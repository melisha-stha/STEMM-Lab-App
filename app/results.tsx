import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { getTeamData, saveParachuteResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

function formatTime(ms: number) {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function parseAttempts(raw: unknown): { time: number; videoUri?: string }[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    
    // We map the parsed data to ensure it fits our object structure
    return parsed.map((item) => ({
      time: typeof item === 'number' ? item : (item.time || 0),
      videoUri: item.videoUri || undefined,
    }));
  } catch (e) {
    console.error("Error parsing attempts:", e);
    return [];
  }
}

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ attempts?: string }>();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');

  const attempts = useMemo(() => parseAttempts(params.attempts), [params.attempts]);
  const best = useMemo(() => (attempts.length ? Math.max(...attempts) : null), [attempts]);

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!attempts.length) {
      Alert.alert('No attempts', 'Please record at least one attempt before submitting.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Add a reflection', 'Write a short note about what design worked best.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      await saveParachuteResults({
        activity: 'parachute',
        createdAt: Date.now(),
        attempts,
        bestAttempt: best,
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Parachute Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Review your attempts and submit your results.</Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Attempts</Text>

        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No attempts were provided. Go back and record a trial first.
          </Text>
        ) : (
          <View style={[styles.attemptsList, { borderTopColor: border }]}>
           {attempts.map((item, idx) => { 
              const isBest = best != null && item.time === best; 
              return (
                <View
                  key={`${idx}-${item.time}`} 
                  style={[
                    styles.attemptRowCard,
                    {
                      backgroundColor: card,
                      borderColor: isBest ? success : border,
                    },
                  ]}>
                  <View style={styles.attemptRowLeft}>
                    <Text style={[styles.attemptLabel, { color: mutedText }]}>Attempt {idx + 1}</Text>
                    <Text style={[styles.attemptValue, { color: text }]}>{formatTime(item.time)}s</Text> 
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
          What design worked best?
        </Text>
        <Input
          label="Comment"
          placeholder="What design worked best?"
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
          onPress={handleSubmit}
          disabled={isSubmitting || attempts.length === 0 || reflection.trim().length === 0}
        />
        <PrimaryButton label="View leaderboard" variant="secondary" onPress={() => router.push('/leaderboard')} />
        <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },

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
  attemptRowLeft: { gap: 6 },
  attemptLabel: { ...Typography.small, fontWeight: '700' },
  attemptValue: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
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

