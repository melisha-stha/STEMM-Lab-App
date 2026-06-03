import { LeaderboardRow as LeaderboardRowCard } from '@/components/leaderboard/LeaderboardRow';
import { OverallChampionCard } from '@/components/leaderboard/OverallChampionCard';
import { type ActivityCardColour } from '@/components/ui/activity-card';
import { ColorPanel, PanelMuted, PanelTitle, usePanelTheme } from '@/components/ui/activity-color-panel';
import {
  LeaderboardScreenBackground,
  useLeaderboardScreenBackground,
} from '@/components/ui/leaderboard-screen-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import {
  computeOverallStandings,
  dedupeBestPerTeam,
  getActivityMetric,
  getLeaderboardDiscriminator,
  getLeaderboardYearLabel,
  getStandingDiscriminator,
  getStandingYearLabel,
  LEADERBOARD_ACTIVITIES,
  OVERALL_RANKINGS_DISPLAY_LIMIT,
  prepareActivityLeaderboard,
  type LeaderboardActivity,
  type LeaderboardRow,
  type OverallTeamStanding,
} from '@/utils/scoring/leaderboard-scoring';
import { usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

type Activity = LeaderboardActivity;

const ACTIVITY_LABELS: Record<Activity, string> = {
  parachute: 'Parachute',
  sound: 'Sound',
  handfan: 'Hand Fan',
  earthquake: 'Earthquake',
  performance: 'Human Performance',
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

function resolveAvatarKey(
  standing: {
    teamId?: string | number;
    teamName?: string;
    avatarKey?: string | null;
  },
  localTeam: { id?: number; name?: string; avatarKey?: string } | null
): string | undefined {
  const isThisDeviceTeam =
    localTeam?.id != null && standing.teamId != null
      ? String(localTeam.id) === String(standing.teamId)
      : localTeam?.name && standing.teamName
        ? String(localTeam.name).trim().toLowerCase() ===
          String(standing.teamName).trim().toLowerCase()
        : false;
  if (isThisDeviceTeam) {
    return localTeam?.avatarKey ?? standing.avatarKey ?? undefined;
  }
  return standing.avatarKey ?? undefined;
}

function subscribeActivityRaw(
  activity: Activity,
  onData: (rows: LeaderboardRow[]) => void,
  onError: () => void
): () => void {
  const handleRaw = (rows: LeaderboardRow[]) => onData(rows);
  const handleError = () => onError();

  switch (activity) {
    case 'parachute':
      return subscribeToLeaderboard(handleRaw, handleError);
    case 'sound':
      return subscribeToSoundLeaderboard(handleRaw, handleError);
    case 'handfan':
      return subscribeToHandFanLeaderboard(handleRaw, handleError);
    case 'earthquake':
      return subscribeToEarthquakeLeaderboard(handleRaw, handleError);
    case 'performance':
      return subscribeToPerformanceLeaderboard(handleRaw, handleError);
    case 'reaction':
      return subscribeToReactionLeaderboard(handleRaw, handleError);
    case 'breathing':
      return subscribeToBreathingLeaderboard(handleRaw, handleError);
    default:
      return () => {};
  }
}

function LeaderboardHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Leaderboard
    </Text>
  );
}

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

function OverallEmptyState() {
  const { textColor, borderColor } = usePanelTheme();

  return (
    <View style={styles.emptyState}>
      <MaterialIcons name="emoji-events" size={40} color={borderColor} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>No overall winner yet</Text>
      <PanelMuted style={styles.emptySubtext}>
        Complete activities to start building team points.
      </PanelMuted>
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
  const danger = useThemeColor({}, 'danger');

  const [activeActivity, setActiveActivity] = useState<Activity>('parachute');
  const [results, setResults] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const [overallLoading, setOverallLoading] = useState(true);
  const [overallError, setOverallError] = useState(false);
  const [activityBuckets, setActivityBuckets] = useState<
    Partial<Record<Activity, LeaderboardRow[]>>
  >({});
  const [localTeam, setLocalTeam] = useState<{
    id?: number;
    name?: string;
    avatarKey?: string;
  } | null>(null);

  const activeColour = ACTIVITY_COLOURS[activeActivity];

  const overallStandings = useMemo(
    () => computeOverallStandings(activityBuckets),
    [activityBuckets]
  );
  const champion = overallStandings[0] ?? null;
  const overallRankings = champion
    ? overallStandings.slice(1, OVERALL_RANKINGS_DISPLAY_LIMIT + 1)
    : overallStandings.slice(0, OVERALL_RANKINGS_DISPLAY_LIMIT);

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
    setOverallLoading(true);
    setOverallError(false);

    const unsubs = LEADERBOARD_ACTIVITIES.map((activity) =>
      subscribeActivityRaw(
        activity,
        (raw) => {
          setActivityBuckets((prev) => ({
            ...prev,
            [activity]: dedupeBestPerTeam(activity, raw),
          }));
          setOverallLoading(false);
        },
        () => {
          setOverallError(true);
          setOverallLoading(false);
        }
      )
    );

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setActivityError(false);
    setResults([]);

    const unsubscribe = subscribeActivityRaw(
      activeActivity,
      (raw) => {
        setResults(prepareActivityLeaderboard(activeActivity, raw));
        setLoading(false);
      },
      () => {
        setActivityError(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeActivity]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <LeaderboardScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <ScreenBackButton />

          <ColorPanel colour="lavender">
            {pixelFontLoaded ? <LeaderboardHeroTitle pixelFamily={pixelFamily} /> : null}
            <PanelMuted style={styles.heroSubtitle}>Team rankings across STEMM Lab</PanelMuted>
            <PanelMuted style={styles.heroBody}>
              See the all-time champion from activity points, then pick an activity for live top 10
              teams.
            </PanelMuted>
          </ColorPanel>

          <ColorPanel colour="yellow">
            <PanelTitle>All-Time Lab Champion</PanelTitle>
            {overallLoading ? (
              <ActivityIndicator size="small" color={primary} style={styles.loader} />
            ) : overallError ? (
              <Text style={[styles.errorText, { color: danger }]}>
                Could not load overall rankings. Pull to refresh or try again shortly.
              </Text>
            ) : champion ? (
              <OverallChampionCard
                champion={champion}
                avatarKey={resolveAvatarKey(champion, localTeam)}
              />
            ) : (
              <OverallEmptyState />
            )}
          </ColorPanel>

          {!overallLoading && !overallError && overallRankings.length > 0 ? (
            <ColorPanel colour="mint">
              <PanelTitle>Overall Rankings</PanelTitle>
              <PanelMuted style={styles.listHint}>Top teams by points across activities</PanelMuted>
              <View style={styles.list}>
                {overallRankings.map((standing, idx) => (
                  <LeaderboardRowCard
                    key={standing.teamKey}
                    rank={champion ? idx + 2 : idx + 1}
                    avatarKey={resolveAvatarKey(standing, localTeam)}
                    teamName={standing.teamName}
                    discriminator={getStandingDiscriminator(standing)}
                    yearLabel={getStandingYearLabel(standing)}
                    pointsLine={`${standing.totalPoints} pts · ${standing.activitiesCompleted} activities`}
                    compact
                  />
                ))}
              </View>
            </ColorPanel>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}>
            {LEADERBOARD_ACTIVITIES.map((activity) => {
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
            <PanelMuted style={styles.listHint}>
              Top 10 teams · one best result per team · live rankings
            </PanelMuted>

            {loading ? (
              <ActivityIndicator size="small" color={primary} style={styles.loader} />
            ) : activityError ? (
              <Text style={[styles.errorText, { color: danger }]}>
                Could not load this activity leaderboard. Try again shortly.
              </Text>
            ) : results.length === 0 ? (
              <LeaderboardEmptyState activityName={ACTIVITY_DISPLAY_NAMES[activeActivity]} />
            ) : (
              <View style={styles.list}>
                {results.map((result, idx) => {
                  const metric = getActivityMetric(activeActivity, result);
                  const discriminator = getLeaderboardDiscriminator(result);
                  const yearLabel = getLeaderboardYearLabel(result);
                  return (
                    <LeaderboardRowCard
                      key={`${result.id}-${idx}`}
                      rank={idx + 1}
                      avatarKey={resolveAvatarKey(result, localTeam)}
                      teamName={result.teamName ?? `Team ${discriminator}`}
                      discriminator={discriminator}
                      yearLabel={yearLabel}
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
  errorText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: FontWeight.semibold,
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
});
