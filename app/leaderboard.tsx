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
import { Image } from 'expo-image';
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
import { useFocusEffect } from '@react-navigation/native';
import {
  subscribeToBreathingLeaderboard,
  subscribeToEarthquakeLeaderboard,
  subscribeToHandFanLeaderboard,
  subscribeToLeaderboard,
  subscribeToPerformanceLeaderboard,
  subscribeToReactionLeaderboard,
  subscribeToSoundLeaderboard,
} from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

const ACTIVITIES = [
  'parachute',
  'sound',
  'handfan',
  'earthquake',
  'performance',
  'reaction',
  'breathing',
] as const;
type Activity = (typeof ACTIVITIES)[number];

const ACTIVITY_LABELS: Record<Activity, string> = {
  parachute: 'Parachute',
  sound: 'Sound',
  handfan: 'Hand Fan',
  earthquake: 'Earthquake',
  performance: 'Performance',
  reaction: 'Reaction',
  breathing: 'Breathing',
};

const ACTIVITY_DISPLAY_NAMES: Record<Activity, string> = {
  parachute: 'Parachute Drop',
  sound: 'Sound Pollution',
  handfan: 'Hand Fan Challenge',
  earthquake: 'Earthquake',
  performance: 'Human Performance Lab',
  reaction: 'Reaction Board',
  breathing: 'Breathing Pace',
};

const ACTIVITY_COLOURS: Record<Activity, ActivityCardColour> = {
  parachute: 'mint',
  sound: 'peach',
  handfan: 'orange',
  earthquake: 'lavender',
  performance: 'pink',
  reaction: 'yellow',
  breathing: 'sky',
};

type LeaderboardResult = {
  id: string;
  teamName?: string;
  grade?: string;
  yearLevel?: string;
  learningLevel?: string;
  teamId?: string | number;
  avatarKey?: string | null;
  userId?: string;
  bestTime?: number;
  measurements?: { db: number; label: string }[];
  peakDb?: number;
  bestBendAngle?: number;
  bestScore?: number;
  avgReactionTimeMs?: number | null;
  sessionsCount?: number;
  bestControlScore?: number | null;
};

const AVATAR_SOURCE: Record<string, any> = {
  ben: require('@/assets/images/boy-avatar.png'),
  girl: require('@/assets/images/girl-avatar.png'),
  frog: require('@/assets/images/frog-avatar.png'),
  bunny: require('@/assets/images/bunny-avatar.png'),
  cat: require('@/assets/images/cat-avatar.png'),
  fox: require('@/assets/images/fox-avatar.png'),
};

const getAvatarSource = (key?: string) => {
  if (!key) return null;
  return AVATAR_SOURCE[key] ?? null;
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

const getYearLabel = (result: LeaderboardResult): string | null => {
  const raw = (result.yearLevel ?? result.grade ?? '').toString().trim();
  if (!raw) return null;
  return /^year\s+/i.test(raw) ? raw : `Year ${raw}`;
};

const getActivityMetric = (
  activity: Activity,
  result: LeaderboardResult
): { primary: string; label: string } => {
  switch (activity) {
    case 'parachute':
      return {
        primary: result.bestTime != null ? `${(result.bestTime / 1000).toFixed(2)}s` : '—',
        label: 'Longest drop time',
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
        label: 'Highest detection',
      };
    }
    case 'handfan':
      return {
        primary: result.bestBendAngle != null ? `${Number(result.bestBendAngle).toFixed(0)}°` : '—',
        label: 'Largest bend angle',
      };
    case 'earthquake':
      return {
        primary: result.bestScore != null ? `${result.bestScore}/100` : '—',
        label: 'Highest stability score',
      };
    case 'performance':
      return {
        primary: result.bestControlScore != null ? `${result.bestControlScore}` : '—',
        label: 'Highest control score',
      };
    case 'reaction':
      return {
        primary: result.avgReactionTimeMs != null ? `${result.avgReactionTimeMs} ms` : '—',
        label: 'Fastest average reaction',
      };
    case 'breathing':
      return {
        primary: result.sessionsCount != null ? `${result.sessionsCount}` : '0',
        label: 'Sessions recorded',
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
  avatarKey?: string;
  teamName: string;
  discriminator: string;
  yearLabel?: string | null;
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

function LeaderboardRow({
  rank,
  avatarKey,
  teamName,
  discriminator,
  yearLabel,
  metricPrimary,
  metricLabel,
}: LeaderboardRowProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const gold = useThemeColor({}, 'gold');
  const isPodium = rank <= 3;
  const avatarSource = getAvatarSource(avatarKey);

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
      <View style={[styles.avatarWrap, { borderColor: isPodium ? gold : borderColor }]}>
        {avatarSource ? (
          <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
        ) : null}
      </View>
      <View style={styles.main}>
        <Text style={[styles.teamId, { color: textColor }]} numberOfLines={1}>
          {teamName}
        </Text>
        <Text style={[styles.meta, { color: textColor, opacity: 0.75 }]} numberOfLines={1}>
          Team ID {discriminator}
          {yearLabel ? ` · ${yearLabel}` : ''}
        </Text>
        <Text style={[styles.meta, { color: textColor, opacity: 0.9 }]} numberOfLines={1}>
          {metricLabel}: {metricPrimary}
        </Text>
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
  const [localTeam, setLocalTeam] = useState<any | null>(null);

  const activeColour = ACTIVITY_COLOURS[activeActivity];

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      void getTeamData().then((data) => {
        if (active) setLocalTeam(data);
      });
      return () => {
        active = false;
      };
    }, [])
  );

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
    } else if (activeActivity === 'handfan') {
      unsubscribe = subscribeToHandFanLeaderboard((data) => {
        setResults(data as any);
        setLoading(false);
      });
    } else if (activeActivity === 'earthquake') {
      unsubscribe = subscribeToEarthquakeLeaderboard((data) => {
        setResults(data);
        setLoading(false);
      });
    } else if (activeActivity === 'performance') {
      unsubscribe = subscribeToPerformanceLeaderboard((data) => {
        setResults(data as any);
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
                  const discriminator = getTeamDiscriminator(result);
                  const isThisDeviceTeam =
                    localTeam?.id != null && result.teamId != null
                      ? String(localTeam.id) === String(result.teamId)
                      : localTeam?.name && result.teamName
                        ? String(localTeam.name).trim().toLowerCase() ===
                          String(result.teamName).trim().toLowerCase()
                        : false;
                  const avatarKey =
                    result.avatarKey != null
                      ? result.avatarKey
                      : isThisDeviceTeam
                        ? localTeam?.avatarKey
                        : undefined;
                  return (
                    <LeaderboardRow
                      key={result.id}
                      rank={idx + 1}
                      avatarKey={avatarKey}
                      teamName={result.teamName ?? `Team ${discriminator}`}
                      discriminator={discriminator}
                      yearLabel={getYearLabel(result)}
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
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  avatar: {
    width: '100%',
    height: '100%',
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
});
