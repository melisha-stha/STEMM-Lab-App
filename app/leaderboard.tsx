import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

import { subscribeToLeaderboard } from '../hooks/firestore';

function formatTime(ms: number) {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const success = useThemeColor({}, 'success');

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This replaces the old local 'load' function
    const unsubscribe = subscribeToLeaderboard((data) => {
      setResults(data);
      setLoading(false);
    });

    // Cleanup: Stop listening if the user leaves the screen
    return () => unsubscribe();
  }, []);

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Global Leaderboard</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Parachute Drop • Slowest fall wins
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Top teams</Text>

        {loading ? (
          <ActivityIndicator size="small" color={text} style={{ marginVertical: 20 }} />
        ) : results.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No cloud results yet. Complete the activity and click Finish to appear here!
          </Text>
        ) : (
          <View style={[styles.list, { borderTopColor: border }]}>
            {results.map((r, idx) => {
              const isFirst = idx === 0;
              return (
                <View
                  key={r.id}
                  style={[
                    styles.row,
                    {
                      backgroundColor: card,
                      borderColor: isFirst ? success : border,
                    },
                  ]}>
                  <View style={styles.rankWrap}>
                    <Text style={[styles.rank, { color: text }]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.main}>
                    <Text style={[styles.teamName, { color: text }]} numberOfLines={1}>
                      {r.teamName}
                    </Text>
                    <Text style={[styles.meta, { color: mutedText }]} numberOfLines={1}>
                      Grade: {r.grade ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.score}>
                    <Text style={[styles.bestLabel, { color: mutedText }]}>Best</Text>
                    <Text style={[styles.bestValue, { color: text }]}>
                      {r.bestTime != null ? `${formatTime(r.bestTime)}s` : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <View style={styles.actions}>
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
  list: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.sm },
  row: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rankWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  rank: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 4 },
  teamName: { ...Typography.section, fontSize: 15 },
  meta: { ...Typography.small },
  score: { alignItems: 'flex-end', gap: 4 },
  bestLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 0.8 },
  bestValue: { fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] },
  actions: { gap: Spacing.sm },
});