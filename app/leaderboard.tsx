import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

import {
  subscribeToEarthquakeLeaderboard,
  subscribeToLeaderboard,
  subscribeToReactionLeaderboard,
  subscribeToSoundLeaderboard,
} from '../hooks/firestore';

const ACTIVITIES = ['parachute', 'sound', 'earthquake', 'reaction'] as const;
type Activity = (typeof ACTIVITIES)[number];

const ACTIVITY_LABELS: Record<Activity, string> = {
  parachute: 'Parachute',
  sound: 'Sound',
  earthquake: 'Earthquake',
  reaction: 'Reaction',
};

const ACTIVITY_DISPLAY_NAMES: Record<Activity, string> = {
  parachute: 'Parachute Drop',
  sound: 'Sound Pollution',
  earthquake: 'Earthquake',
  reaction: 'Reaction Board',
};

type LeaderboardResult = {
  id: string;
  grade?: string;
  teamId?: string | number;
  userId?: string;
  bestTime?: number;
  measurements?: { db: number; label: string }[];
  peakDb?: number;
  bestScore?: number;
  bestReactionTime?: number;
};

const getTeamDiscriminator = (result: LeaderboardResult): string => {
  if (result.teamId != null && String(result.teamId).length > 0) {
    return String(result.teamId);
  }
  if (result.userId && result.userId.length >= 6) {
    return result.userId.slice(-6);
  }
  if (result.id && result.id.length >= 6) {
    return result.id.slice(-6);
  }
  return '—';
};

const getActivityMetric = (
  activity: Activity,
  result: LeaderboardResult
): { primary: string; label: string } => {
  switch (activity) {
    case 'parachute':
      return {
        primary: result.bestTime != null ? `${(result.bestTime / 1000).toFixed(2)}s` : '—',
        label: 'Drop time',
      };
    case 'sound': {
      const peakDb =
        result.peakDb != null
          ? result.peakDb
          : result.measurements
            ? Math.max(...result.measurements.map((m) => m.db))
            : 0;
      return {
        primary: `${peakDb.toFixed(1)} dB`,
        label: 'Peak sound',
      };
    }
    case 'earthquake':
      return {
        primary: result.bestScore != null ? `${result.bestScore}/100` : '—',
        label: 'Stability score',
      };
    case 'reaction':
      return {
        primary:
          result.bestReactionTime != null ? `${result.bestReactionTime} ms` : '—',
        label: 'Best reaction time',
      };
  }
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const success = useThemeColor({}, 'success');

  const [activeActivity, setActiveActivity] = useState<Activity>('parachute');
  const [results, setResults] = useState<LeaderboardResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setResults([]);

    let unsubscribe: () => void;

    if (activeActivity === 'parachute') {
      unsubscribe = subscribeToLeaderboard((data) => {
        setResults(data as LeaderboardResult[]);
        setLoading(false);
      });
    } else if (activeActivity === 'sound') {
      unsubscribe = subscribeToSoundLeaderboard((data) => {
        setResults(data);
        setLoading(false);
      });
    } else if (activeActivity === 'earthquake') {
      unsubscribe = subscribeToEarthquakeLeaderboard((data) => {
        setResults(data);
        setLoading(false);
      });
    } else if (activeActivity === 'reaction') {
      unsubscribe = subscribeToReactionLeaderboard((data) => {
        setResults(data);
        setLoading(false);
      });
    }

    return () => unsubscribe?.();
  }, [activeActivity]);

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Leaderboard</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Top 10 teams per activity</Text>
      </View>

      <View style={styles.pillRow}>
        {ACTIVITIES.map((activity) => {
          const isActive = activeActivity === activity;
          return (
            <Pressable
              key={activity}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setActiveActivity(activity)}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? primary : card,
                  borderColor: isActive ? primary : border,
                },
              ]}>
              <Text
                style={[styles.pillLabel, { color: isActive ? onPrimary : text }]}
                numberOfLines={1}>
                {ACTIVITY_LABELS[activity]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>
          {ACTIVITY_DISPLAY_NAMES[activeActivity]}
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={text} style={styles.loader} />
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="leaderboard" size={40} color={mutedText} />
            <Text style={[styles.emptyTitle, { color: text }]}>
              No {ACTIVITY_DISPLAY_NAMES[activeActivity]} results yet
            </Text>
            <Text style={[styles.emptySubtext, { color: mutedText }]}>
              Complete the activity to appear on the leaderboard
            </Text>
          </View>
        ) : (
          <View style={[styles.list, { borderTopColor: border }]}>
            {results.map((result, idx) => {
              const isFirst = idx === 0;
              const metric = getActivityMetric(activeActivity, result);
              return (
                <View
                  key={result.id}
                  style={[
                    styles.row,
                    {
                      backgroundColor: card,
                      borderColor: isFirst ? success : border,
                    },
                  ]}>
                  <View style={[styles.rankWrap, { borderColor: border }]}>
                    <Text style={[styles.rank, { color: text }]}>{idx + 1}</Text>
                  </View>
                  <View style={styles.main}>
                    <Text style={[styles.teamId, { color: text }]} numberOfLines={1}>
                      Team ID: {getTeamDiscriminator(result)}
                    </Text>
                    <Text style={[styles.meta, { color: mutedText }]} numberOfLines={1}>
                      Grade: {result.grade ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.score}>
                    <Text style={[styles.metricValue, { color: text }]}>{metric.primary}</Text>
                    <Text style={[styles.metricLabel, { color: mutedText }]}>{metric.label}</Text>
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
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  pillLabel: {
    ...Typography.small,
    fontWeight: '700',
  },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  loader: { marginVertical: 20 },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  emptyTitle: { ...Typography.section, textAlign: 'center' },
  emptySubtext: { ...Typography.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },
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
  },
  rank: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 4 },
  teamId: { ...Typography.section, fontSize: 15 },
  meta: { ...Typography.small },
  score: { alignItems: 'flex-end', gap: 4 },
  metricValue: { fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] },
  metricLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 0.8 },
  actions: { gap: Spacing.sm },
});
