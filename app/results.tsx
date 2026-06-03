import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { getTrials } from '@/hooks/database';
import { getTeamData, saveParachuteResults } from '@/hooks/storage';
import { useScreenScrollInsets } from '@/hooks/use-screen-scroll-insets';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatCentisecondsTimer } from '@/utils/formatters/duration';

export default function ResultsScreen() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<{ time: number; videoUri?: string }[]>([]);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');
  const { scrollContentStyle } = useScreenScrollInsets();

  // Load attempts from SQLite on mount 
  useEffect(() => {
    try {
      const trials = getTrials();
      const parachuteTrials = trials
        .filter(t => t.activity === 'parachute')
        .slice(0, 3) // get the latest 3
        .map(t => ({ time: t.time, videoUri: t.videoUri || undefined }));
      setAttempts(parachuteTrials);
    } catch (e) {
      console.error('Failed to load trials from SQLite:', e);
    }
  }, []);

  const best = useMemo(() => (attempts.length ? Math.max(...attempts.map(a => a.time)) : null), [attempts]);
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
      Alert.alert('Saved', 'Reflection saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, scrollContentStyle]}>
        <ScreenBackButton />
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
                    <Text style={[styles.attemptValue, { color: text }]}>{formatCentisecondsTimer(item.time)}s</Text> 
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

