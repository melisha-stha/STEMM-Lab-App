import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

function formatTime(ms: number) {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function parseAttempts(raw: unknown): number[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((n) => (typeof n === 'number' ? n : Number(n)))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
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
  const best = useMemo(() => (attempts.length ? Math.min(...attempts) : null), [attempts]);

  const [reflection, setReflection] = useState('');

  const handleSubmit = () => {
    // Placeholder until we persist results per activity.
    Alert.alert('Saved', 'Reflection submitted. (Next: save this to history.)');
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review your attempts, identify the best result, and reflect on improvements.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Attempts</Text>

        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No attempts were provided. Go back and record a trial first.
          </Text>
        ) : (
          <View style={[styles.attemptsGrid, { borderTopColor: border }]}>
            {attempts.map((ms, idx) => {
              const isBest = best != null && ms === best;
              return (
                <View
                  key={`${idx}-${ms}`}
                  style={[
                    styles.attemptCard,
                    {
                      backgroundColor: card,
                      borderColor: isBest ? success : border,
                    },
                    isBest ? styles.bestCard : null,
                  ]}>
                  <View style={styles.attemptTopRow}>
                    <Text style={[styles.attemptLabel, { color: mutedText }]}>Attempt {idx + 1}</Text>
                    {isBest ? (
                      <View style={[styles.badge, { backgroundColor: success }]}>
                        <Text style={[styles.badgeText, { color: '#071018' }]}>Best</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.attemptValue, { color: text }]}>{formatTime(ms)}s</Text>
                  <Text style={[styles.attemptHint, { color: mutedText }]}>
                    {isBest ? 'Fastest time' : 'Recorded trial'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Reflection</Text>
        <Text style={[styles.help, { color: mutedText }]}>
          What did you change between attempts? What worked best, and why?
        </Text>
        <Input
          label="Comment"
          placeholder="e.g., We increased canopy size and reduced string tangles..."
          value={reflection}
          onChangeText={setReflection}
          multiline
          textAlignVertical="top"
          style={styles.reflectionInput}
        />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton label="Submit reflection" onPress={handleSubmit} disabled={reflection.trim().length === 0} />
        <PrimaryButton label="Back to Home" variant="secondary" onPress={() => router.replace('/(tabs)')} />
        <PrimaryButton
          label="Back to Parachute"
          variant="secondary"
          onPress={() => router.back()}
          style={{ borderColor: primary }}
        />
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

  attemptsGrid: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  attemptCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  bestCard: {
    transform: [{ scale: 1.01 }],
  },
  attemptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  attemptLabel: { ...Typography.small, fontWeight: '700' },
  attemptValue: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  attemptHint: { marginTop: Spacing.xs, ...Typography.small },
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

