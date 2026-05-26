import { ActivityCard, type ActivityCardColour } from '@/components/ui/activity-card';
import { AuthScreenBackground, useAuthScreenBackground } from '@/components/ui/auth-screen-background';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { resolveAppRoute } from '@/hooks/app-routing';
import { getTrials } from '@/hooks/database';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { getTeamData } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../hooks/firebaseConfig';

const TOTAL_ACTIVITIES = 7;
const HORIZONTAL_PAD = 20;

interface TeamData {
  name: string;
  id: number;
  members: string[];
  grade: string;
  yearLevel?: string;
  learningLevel?: string;
}

interface TrialRow {
  activity: string;
  teamName?: string;
}

type ActivityItem = {
  title: string;
  subtitle: string;
  colour: ActivityCardColour;
  badge: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  activityKey: string;
  comingSoon?: boolean;
};

const ACTIVITIES: ActivityItem[] = [
  {
    title: 'Parachute Drop',
    subtitle: 'Engineering · Physics',
    colour: 'mint',
    badge: 'Engineering',
    route: '/parachute',
    icon: 'flight-land',
    activityKey: 'parachute',
  },
  {
    title: 'Sound Pollution Hunter',
    subtitle: 'Health · Physics',
    colour: 'peach',
    badge: 'Health',
    route: '/sound',
    icon: 'graphic-eq',
    activityKey: 'sound',
  },
  {
    title: 'Earthquake Structure',
    subtitle: 'Engineering · Earth Science',
    colour: 'lavender',
    badge: 'Engineering',
    route: '/earthquake',
    icon: 'domain',
    activityKey: 'earthquake',
  },
  {
    title: 'Reaction Board',
    subtitle: 'Health · Neuroscience',
    colour: 'yellow',
    badge: 'Health',
    route: '/reaction',
    icon: 'flash-on',
    activityKey: 'reaction',
  },
  {
    title: 'Breathing Pace Trainer',
    subtitle: 'Health · Biology',
    colour: 'sky',
    badge: 'Health',
    route: '/breathing',
    icon: 'air',
    activityKey: 'breathing',
  },
  {
    title: 'Hand Fan Challenge',
    subtitle: 'Engineering · Physics',
    colour: 'orange',
    badge: 'Engineering',
    route: '/handfan',
    icon: 'toys',
    activityKey: 'handfan',
  },
  {
    title: 'Human Performance Lab',
    subtitle: 'Health · Biology',
    colour: 'pink',
    badge: 'Health',
    route: '/performance',
    icon: 'directions-run',
    activityKey: 'performance',
  },
];

const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.activityKey);

const MISSION_HOOK: Record<string, string> = {
  parachute: 'Film, time, and compare — like real engineers.',
  sound: 'Measure noise levels across your school.',
  earthquake: 'Build a structure that survives the shake.',
  reaction: 'How fast is your brain? Test all team members.',
  breathing: 'Track how exercise changes your breathing rate.',
  handfan: 'Design the best hand fan and measure the airflow.',
  performance: 'Track strength, speed, and endurance like a sports lab.',
};

const MISSION_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  parachute: 'flight-land',
  sound: 'graphic-eq',
  earthquake: 'domain',
  reaction: 'flash-on',
  breathing: 'air',
  handfan: 'toys',
  performance: 'directions-run',
};

const MISSION_ROUTE: Record<string, Href> = {
  parachute: '/parachute',
  sound: '/sound',
  earthquake: '/earthquake',
  reaction: '/reaction',
  breathing: '/breathing',
  handfan: '/handfan',
  performance: '/performance',
};

const MISSION_HEADLINE: Record<string, { stream: string; action: string }> = {
  parachute: { stream: 'Engineering', action: 'Drop Challenge' },
  sound: { stream: 'Health', action: 'Sound Hunt' },
  earthquake: { stream: 'Engineering', action: 'Structure Test' },
  reaction: { stream: 'Health', action: 'Reaction Board' },
  breathing: { stream: 'Health', action: 'Breathing Pace' },
  handfan: { stream: 'Engineering', action: 'Fan Challenge' },
  performance: { stream: 'Health', action: 'Performance Lab' },
};

const COMING_SOON_KEYS = new Set(ACTIVITIES.filter((a) => a.comingSoon).map((a) => a.activityKey));

const getGreeting = (name: string) => {
  const h = new Date().getHours();
  const emoji = h < 12 ? '🌅' : h < 17 ? '⚗️' : '🌙';
  const line1 = h < 12 ? 'Good morning,' : h < 17 ? 'Welcome back,' : 'Evening lab,';
  return { emoji, line1, line2: name };
};

function DotGridBackground({ dotColor }: { dotColor: string }) {
  const { width } = Dimensions.get('window');
  const cols = Math.ceil(width / 24) + 1;
  const rows = Math.ceil((Dimensions.get('window').height * 1.5) / 24);
  return (
    <View style={styles.dotGrid} pointerEvents="none">
      {Array.from({ length: rows }, (_, row) => (
        <View key={`dot-row-${row}`} style={styles.dotRow}>
          {Array.from({ length: cols }, (_, col) => (
            <View
              key={`dot-${row}-${col}`}
              style={[styles.dot, { backgroundColor: dotColor, marginRight: 24 - 5, marginBottom: 24 - 5 }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function MissionCornerSquares({ color }: { color: string }) {
  const corners = [
    styles.cornerTopLeft,
    styles.cornerTopRight,
    styles.cornerBottomLeft,
    styles.cornerBottomRight,
  ];
  return (
    <>
      {corners.map((cornerStyle, index) => (
        <View key={`corner-${index}`} style={[styles.cornerSquare, cornerStyle, { backgroundColor: color }]} />
      ))}
    </>
  );
}

type StatCardProps = {
  backgroundColor: string;
  borderColor: string;
  shadowColor: string;
  textColor: string;
  iconName: keyof typeof MaterialIcons.glyphMap;
  value: number;
  unit: string;
  label: string;
  iconBg: string;
};

function StatCard({
  backgroundColor,
  borderColor,
  shadowColor,
  textColor,
  iconName,
  value,
  unit,
  label,
  iconBg,
}: StatCardProps) {
  return (
    <View
      style={[
        styles.statCardOuter,
        { borderColor, borderBottomColor: shadowColor, backgroundColor },
      ]}>
      <View style={[styles.statCardInner, { backgroundColor }]}>
        <View style={[styles.statIconTile, { backgroundColor: iconBg }]}>
          <MaterialIcons name={iconName} size={22} color={textColor} />
        </View>
        <Text style={[styles.statNumber, { color: textColor }]}>{value}</Text>
        <Text style={[styles.statUnit, { color: textColor, opacity: 0.7 }]}>{unit}</Text>
        <Text style={[styles.statLabel, { color: textColor }]}>{label}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [trials, setTrials] = useState<TrialRow[]>([]);
  const { overlayColor, imageOpacity } = useAuthScreenBackground();

  const background = useThemeColor({}, 'background');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const gold = useThemeColor({}, 'gold');
  const onGold = useThemeColor({}, 'onGold');
  const border = useThemeColor({}, 'border');
  const cardLavender = useThemeColor({}, 'cardLavender');
  const cardLavenderBorder = useThemeColor({}, 'cardLavenderBorder');
  const cardLavenderShadow = useThemeColor({}, 'cardLavenderShadow');
  const cardLavenderText = useThemeColor({}, 'cardLavenderText');
  const cardLavenderDecor = useThemeColor({}, 'cardLavenderDecor');
  const cardMint = useThemeColor({}, 'cardMint');
  const cardMintBorder = useThemeColor({}, 'cardMintBorder');
  const cardMintShadow = useThemeColor({}, 'cardMintShadow');
  const cardMintText = useThemeColor({}, 'cardMintText');
  const cardYellow = useThemeColor({}, 'cardYellow');
  const cardYellowBorder = useThemeColor({}, 'cardYellowBorder');
  const cardYellowShadow = useThemeColor({}, 'cardYellowShadow');
  const cardYellowText = useThemeColor({}, 'cardYellowText');
  const missionBadgeBg = useThemeColor({}, 'missionBadgeBg');
  const missionIconBg = useThemeColor({}, 'missionIconBg');
  const missionIconBorder = useThemeColor({}, 'missionIconBorder');
  const cardIconBg = useThemeColor({}, 'cardIconBg');

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const destination = await resolveAppRoute(Boolean(user));
      if (destination !== '/(tabs)') {
        router.replace(destination);
      }
    });
    const loadTeam = async () => {
      const data = await getTeamData();
      setTeam(data);
    };
    loadTeam();
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    try {
      const rows = getTrials() as TrialRow[];
      setTrials(Array.isArray(rows) ? rows : []);
    } catch {
      setTrials([]);
    }
  }, []);

  const teamName = team?.name?.trim() || 'Team';
  const teamTrials = useMemo(() => {
    const name = team?.name?.trim();
    if (!name) return [];
    return trials.filter((t) => t.teamName === name);
  }, [team?.name, trials]);

  const activitiesExplored = useMemo(
    () => new Set(teamTrials.map((t) => t.activity)).size,
    [teamTrials]
  );
  const progress = Math.min(activitiesExplored / TOTAL_ACTIVITIES, 1);
  const totalAttempts = teamTrials.length;
  const isComplete = activitiesExplored >= TOTAL_ACTIVITIES;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const featuredActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    ACTIVITY_KEYS.forEach((key) => {
      counts[key] = 0;
    });
    teamTrials.forEach((t) => {
      if (counts[t.activity] !== undefined) {
        counts[t.activity]++;
      }
    });
    const least = Object.entries(counts).sort((a, b) => a[1] - b[1])[0];
    return least?.[0] ?? 'parachute';
  }, [teamTrials]);

  const missionHeadline = MISSION_HEADLINE[featuredActivity] ?? MISSION_HEADLINE.parachute;
  const missionIcon = MISSION_ICON[featuredActivity] ?? MISSION_ICON.parachute;
  const missionHook = MISSION_HOOK[featuredActivity] ?? MISSION_HOOK.parachute;
  const missionRoute = MISSION_ROUTE[featuredActivity] ?? MISSION_ROUTE.parachute;
  const missionComingSoon = COMING_SOON_KEYS.has(featuredActivity);
  const greeting = getGreeting(teamName);
  const yearLabel = team?.yearLevel ?? team?.grade ?? '—';

  const completedActivities = useMemo(() => {
    const done = new Set<string>();
    teamTrials.forEach((t) => done.add(t.activity));
    return done;
  }, [teamTrials]);

  const progressFillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleMissionStart = () => {
    if (missionComingSoon) {
      Alert.alert('Coming Soon', 'Coming Soon! This activity is being built. Check back soon!');
      return;
    }
    router.push(missionRoute);
  };

  const handleActivityPress = (activity: ActivityItem) => {
    router.push(activity.route);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top']}>
      <View style={styles.page}>
        <AuthScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
        <DotGridBackground dotColor={text} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.headerRow, { paddingTop: insets.top > 0 ? 8 : Spacing.md }]}>
            <View style={styles.headerLeft}>
              {pixelFontLoaded ? (
                <Text style={[styles.greetingLine1, { color: textSecondary, fontFamily: pixelFamily }]}>
                  {greeting.emoji} {greeting.line1}
                </Text>
              ) : null}
              {pixelFontLoaded ? (
                <Text style={[styles.greetingLine2, { color: text, fontFamily: pixelFamily }]}>
                  {greeting.line2}
                </Text>
              ) : null}
              <View style={[styles.yearPill, { backgroundColor: primarySoft }]}>
                <Text style={[styles.yearPillText, { color: primary }]}>
                  {yearLabel} · Lab Explorer
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lab alerts"
              onPress={() => Alert.alert('Lab Alerts', 'No new alerts')}
              style={[styles.bellBtn, { backgroundColor: backgroundSecondary }]}>
              <MaterialIcons name="notifications-none" size={24} color={textSecondary} />
            </Pressable>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: textSecondary }]}>Lab Progress</Text>
              <Text style={[styles.progressLabel, { color: textSecondary }]}>
                {activitiesExplored} / {TOTAL_ACTIVITIES}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: border }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressFillWidth,
                    backgroundColor: isComplete ? gold : primary,
                  },
                ]}
              />
            </View>
            {isComplete ? (
              <Text style={[styles.progressComplete, { color: gold }]}>⭐ Complete!</Text>
            ) : null}
          </View>

          <View
            style={[
              styles.missionCard,
              {
                backgroundColor: cardLavender,
                borderColor: cardLavenderBorder,
                borderBottomColor: cardLavenderShadow,
              },
            ]}>
            <MissionCornerSquares color={cardLavenderDecor} />
            <View style={[styles.missionBadge, { backgroundColor: missionBadgeBg }]}>
              {pixelFontLoaded ? (
                <Text
                  style={[
                    styles.missionBadgeText,
                    { color: cardLavenderText, fontFamily: pixelFamily },
                  ]}>
                  THIS WEEK&apos;S MISSION
                </Text>
              ) : null}
            </View>

            <Text style={[styles.missionStream, { color: cardLavenderText }]}>
              {missionHeadline.stream}
            </Text>
            <View style={[styles.missionHighlight, { backgroundColor: gold }]}>
              <Text style={[styles.missionHighlightText, { color: onGold }]}>
                {missionHeadline.action}
              </Text>
            </View>
            <Text style={[styles.missionHook, { color: cardLavenderText, opacity: 0.8 }]}>
              {missionHook}
            </Text>

            <View style={styles.missionFooter}>
              <View
                style={[
                  styles.missionIconTile,
                  { backgroundColor: missionIconBg, borderColor: missionIconBorder },
                ]}>
                <MaterialIcons name={missionIcon} size={28} color={cardLavenderText} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start mission"
                onPress={handleMissionStart}
                style={[
                  styles.startButtonOuter,
                  {
                    borderColor: primary,
                    borderBottomColor: primaryDark,
                    backgroundColor: primary,
                  },
                ]}>
                <View style={styles.startButtonInner}>
                  <Text style={[styles.startButtonText, { color: onPrimary }]}>▶  START</Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.statRow}>
            <StatCard
              backgroundColor={cardMint}
              borderColor={cardMintBorder}
              shadowColor={cardMintShadow}
              textColor={cardMintText}
              iconName="science"
              value={activitiesExplored}
              unit="experiments"
              label="Lab Sessions"
              iconBg={cardIconBg}
            />
            <StatCard
              backgroundColor={cardYellow}
              borderColor={cardYellowBorder}
              shadowColor={cardYellowShadow}
              textColor={cardYellowText}
              iconName="repeat"
              value={totalAttempts}
              unit="trials"
              label="Total Attempts"
              iconBg={cardIconBg}
            />
          </View>

          <View style={styles.catalogueSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                {pixelFontLoaded ? (
                  <Text style={[styles.sectionTitle, { color: text, fontFamily: pixelFamily }]}>
                    Your Activities
                  </Text>
                ) : null}
                <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>
                  Record · Analyse · Improve
                </Text>
              </View>
              <View style={[styles.counterPill, { backgroundColor: primarySoft }]}>
                <Text style={[styles.counterPillText, { color: primary }]}>
                  {activitiesExplored}/{TOTAL_ACTIVITIES}
                </Text>
              </View>
            </View>

            <View style={styles.activityList}>
              {ACTIVITIES.map((activity) => (
                <ActivityCard
                  key={activity.activityKey}
                  title={activity.title}
                  subtitle={activity.subtitle}
                  colour={activity.colour}
                  badge={activity.badge}
                  icon={activity.icon}
                  completed={false}
                  comingSoon={false}
                  onPress={() => handleActivityPress(activity)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  page: {
    flex: 1,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: HORIZONTAL_PAD,
  },
  dotGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.04,
  },
  dotRow: {
    flexDirection: 'row',
    height: 24,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    gap: 4,
    paddingRight: Spacing.md,
  },
  greetingLine1: {
    fontSize: 14,
  },
  greetingLine2: {
    fontSize: 28,
    fontWeight: '800',
  },
  yearPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
  },
  yearPillText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    marginTop: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressComplete: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    marginTop: 6,
  },
  missionCard: {
    marginTop: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: 20,
    overflow: 'hidden',
  },
  cornerSquare: {
    position: 'absolute',
    width: 6,
    height: 6,
  },
  cornerTopLeft: {
    top: 8,
    left: 8,
  },
  cornerTopRight: {
    top: 8,
    right: 8,
  },
  cornerBottomLeft: {
    bottom: 8,
    left: 8,
  },
  cornerBottomRight: {
    bottom: 8,
    right: 8,
  },
  missionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  missionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  missionStream: {
    fontSize: 20,
    fontWeight: '800',
  },
  missionHighlight: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  missionHighlightText: {
    fontSize: 20,
    fontWeight: '800',
  },
  missionHook: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  missionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  missionIconTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonOuter: {
    borderRadius: Radius.full,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  startButtonInner: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 20,
  },
  statCardOuter: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    overflow: 'hidden',
  },
  statCardInner: {
    borderRadius: 18,
    padding: 16,
  },
  statIconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 40,
    fontWeight: '900',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  statUnit: {
    fontSize: 11,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    marginTop: 4,
  },
  catalogueSection: {
    marginTop: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  counterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  counterPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  activityList: {
    marginTop: Spacing.xs,
  },
});
