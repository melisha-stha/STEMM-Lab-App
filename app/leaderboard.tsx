import { type ActivityCardColour } from '@/components/ui/activity-card';
import { ColorPanel, PanelMuted, PanelTitle, usePanelTheme } from '@/components/ui/activity-color-panel';
import {
  LeaderboardScreenBackground,
  useLeaderboardScreenBackground,
} from '@/components/ui/leaderboard-screen-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  subscribeToBreathingLeaderboard,
  subscribeToEarthquakeLeaderboard,
  subscribeToLeaderboard,
  subscribeToReactionLeaderboard,
  subscribeToSoundLeaderboard,
} from '../hooks/firestore';

const ACTIVITIES = ['parachute', 'sound', 'earthquake', 'reaction', 'breathing'] as const;
type Activity = (typeof ACTIVITIES)[number];

const ACTIVITY_LABELS: Record<Activity, string> = {
  parachute: 'Parachute',
  sound: 'Sound',
  earthquake: 'Earthquake',
  reaction: 'Reaction',
  breathing: 'Breathing',
};

const ACTIVITY_DISPLAY_NAMES: Record<Activity, string> = {
  parachute: 'Parachute Drop',
  sound: 'Sound Pollution',
  earthquake: 'Earthquake',
  reaction: 'Reaction Board',
  breathing: 'Breathing Pace',
};

const ACTIVITY_COLOURS: Record<Activity, ActivityCardColour> = {
  parachute: 'mint',
  sound: 'peach',
  earthquake: 'lavender',
  reaction: 'yellow',
  breathing: 'sky',
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
  restingBpm?: number;
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
        primary: result.bestReactionTime != null ? `${result.bestReactionTime} ms` : '—',
        label: 'Best reaction time',
      };
    case 'breathing':
      return {
        primary: result.restingBpm != null ? `${result.restingBpm} BPM` : '—',
        label: 'Resting breath rate',
      };
  }
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'] as const;

function LeaderboardHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={[styles.heroTitle, { color: textColor, fontFamily: pixelFamily }]}>Leaderboard</Text>
  );
}

type LeaderboardRowProps = {
  rank: number;
  teamLabel: string;
  grade: string;
  metricPrimary: string;
  metricLabel: string;
};

function LeaderboardEmptyState({ activityName }: { activityName: string }) {
  const { textColor, borderColor } = usePanelTheme();

  return (
    <View style={styles.emptyState}>
      <MaterialIcons name="leaderboard" size={40} color={borderColor} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>No {activityName} results yet</Text>
      <PanelMuted style={styles.emptySubtext}>
        Complete the activity to appear on the leaderboard.
      </PanelMuted>
    </View>
  );
}

function LeaderboardRow({ rank, teamLabel, grade, metricPrimary, metricLabel }: LeaderboardRowProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const gold = useThemeColor({}, 'gold');
  const isPodium = rank <= 3;

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: isPodium ? gold : borderColor,
          backgroundColor: cardIconBg,
        },
      ]}>
      <View style={[styles.rankWrap, { borderColor: isPodium ? gold : borderColor }]}>
        <Text style={[styles.rank, { color: isPodium ? gold : textColor }]}>
          {RANK_MEDALS[rank - 1] ?? rank}
        </Text>
      </View>
      <View style={styles.main}>
        <Text style={[styles.teamId, { color: textColor }]} numberOfLines={1}>
          Team {teamLabel}
        </Text>
        <Text style={[styles.meta, { color: textColor, opacity: 0.75 }]} numberOfLines={1}>
          Grade {grade}
        </Text>
      </View>
      <View style={styles.score}>
        <Text style={[styles.metricValue, { color: borderColor }]}>{metricPrimary}</Text>
        <Text style={[styles.metricLabel, { color: textColor, opacity: 0.75 }]}>{metricLabel}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useLeaderboardScreenBackground();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const [activeActivity, setActiveActivity] = useState<Activity>('parachute');
  const [results, setResults] = useState<LeaderboardResult[]>([]);
  const [loading, setLoading] = useState(true);

  const activeColour = ACTIVITY_COLOURS[activeActivity];

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
    } else if (activeActivity === 'breathing') {
      unsubscribe = subscribeToBreathingLeaderboard((data) => {
        setResults(data);
        setLoading(false);
      });
    }

    return () => unsubscribe?.();
  }, [activeActivity]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <LeaderboardScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </TouchableOpacity>

          <ColorPanel colour="lavender">
            {pixelFontLoaded ? <LeaderboardHeroTitle pixelFamily={pixelFamily} /> : null}
            <PanelMuted style={styles.heroSubtitle}>Top 10 teams per activity</PanelMuted>
            <PanelMuted style={styles.heroBody}>
              Pick an activity below to see how teams rank across the STEMM Lab challenges.
            </PanelMuted>
          </ColorPanel>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}>
            {ACTIVITIES.map((activity) => {
              const isSelected = activeActivity === activity;
              return (
                <Pressable
                  key={activity}
                  onPress={() => setActiveActivity(activity)}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: isSelected ? primary : primarySoft,
                      borderColor: isSelected ? primary : border,
                    },
                  ]}>
                  <Text style={[styles.tabPillText, { color: isSelected ? onPrimary : primary }]}>
                    {ACTIVITY_LABELS[activity]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ColorPanel colour={activeColour}>
            <PanelTitle>{ACTIVITY_DISPLAY_NAMES[activeActivity]}</PanelTitle>
            <PanelMuted style={styles.listHint}>Showing up to 10 teams · live rankings</PanelMuted>

            {loading ? (
              <ActivityIndicator size="small" color={primary} style={styles.loader} />
            ) : results.length === 0 ? (
              <LeaderboardEmptyState activityName={ACTIVITY_DISPLAY_NAMES[activeActivity]} />
            ) : (
              <View style={styles.list}>
                {results.map((result, idx) => {
                  const metric = getActivityMetric(activeActivity, result);
                  return (
                    <LeaderboardRow
                      key={result.id}
                      rank={idx + 1}
                      teamLabel={getTeamDiscriminator(result)}
                      grade={result.grade ?? '—'}
                      metricPrimary={metric.primary}
                      metricLabel={metric.label}
                    />
                  );
                })}
              </View>
            )}
          </ColorPanel>

          <PrimaryButton
            label="Back to dashboard"
            variant="secondary"
            onPress={() => router.replace('/(tabs)')}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: SCREEN_BOTTOM_INSET,
    gap: Spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  heroBody: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  tabPill: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  listHint: {
    marginBottom: Spacing.sm,
    fontSize: FontSize.sm,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  list: {
    gap: Spacing.sm,
  },
  row: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rankWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  rank: {
    fontWeight: '900',
    fontSize: FontSize.md,
    fontVariant: ['tabular-nums'],
  },
  main: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  teamId: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  meta: {
    fontSize: FontSize.xs,
  },
  score: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  metricValue: {
    fontWeight: '900',
    fontSize: FontSize.md,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
