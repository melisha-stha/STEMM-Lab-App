import { ActivityCard } from '@/components/ui/activity-card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FontSize, FontWeight, Radius, Shadow, Spacing } from '@/constants/design';
import { resolveAppRoute } from '@/hooks/app-routing';
import { getTrials } from '@/hooks/database';
import { getTeamData } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../hooks/firebaseConfig';

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
}

const ACTIVITIES = [
  {
    title: 'Parachute Drop',
    subtitle: 'Engineering · Physics',
    colour: 'mint' as const,
    badge: 'Engineering',
    route: '/parachute',
  },
  {
    title: 'Sound Pollution Hunter',
    subtitle: 'Health · Physics',
    colour: 'peach' as const,
    badge: 'Health',
    route: '/sound',
  },
  {
    title: 'Earthquake Structure',
    subtitle: 'Engineering · Earth Science',
    colour: 'lavender' as const,
    badge: 'Engineering',
    route: '/earthquake',
  },
  {
    title: 'Reaction Board',
    subtitle: 'Health · Neuroscience',
    colour: 'yellow' as const,
    badge: 'Health',
    route: '/reaction',
  },
  {
    title: 'Breathing Pace Trainer',
    subtitle: 'Health · Biology',
    colour: 'sky' as const,
    badge: 'Health',
    route: '/breathing',
  },
];

const MISSION_HOOK: Record<string, string> = {
  parachute: 'Film, time, and compare — like real engineers.',
  sound: 'Measure noise levels across your school.',
  earthquake: 'Build a structure that survives the shake.',
  reaction: 'How fast is your brain? Test all team members.',
  breathing: 'Track how exercise changes your breathing rate.',
};

const MISSION_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  parachute: 'flight-land',
  sound: 'graphic-eq',
  earthquake: 'domain',
  reaction: 'flash-on',
  breathing: 'air',
};

const MISSION_ROUTE: Record<string, Href> = {
  parachute: '/parachute',
  sound: '/sound',
  earthquake: '/earthquake',
  reaction: '/reaction',
  breathing: '/breathing',
};

const MISSION_HEADLINE: Record<string, { stream: string; action: string }> = {
  parachute: { stream: 'Engineering', action: 'Drop Challenge' },
  sound: { stream: 'Health', action: 'Sound Hunt' },
  earthquake: { stream: 'Engineering', action: 'Structure Test' },
  reaction: { stream: 'Health', action: 'Reaction Board' },
  breathing: { stream: 'Health', action: 'Breathing Pace' },
};

const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.route.replace('/', ''));

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [trials, setTrials] = useState<TrialRow[]>([]);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const primary = useThemeColor({}, 'primary');
  const shadow = useThemeColor({}, 'shadow' as any) ?? '#000000';

  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary' as any) ?? '#F5F5F7';
  const textSecondary = useThemeColor({}, 'textSecondary' as any) ?? '#6E6E73';
  const textInverse = useThemeColor({}, 'textInverse' as any) ?? '#FFFFFF';
  const primarySoft = useThemeColor({}, 'primarySoft' as any) ?? 'rgba(0, 122, 255, 0.1)';
  const warning = useThemeColor({}, 'warning' as any) ?? '#FF9500';

  const cardLavender = useThemeColor({}, 'cardLavender' as any) ?? '#E8E7FA';
  const cardMint = useThemeColor({}, 'cardMint' as any) ?? '#E2F4EE';
  const cardMintText = useThemeColor({}, 'cardMintText' as any) ?? '#0D523C';
  const cardYellow = useThemeColor({}, 'cardYellow' as any) ?? '#FFF6D6';
  const cardYellowText = useThemeColor({}, 'cardYellowText' as any) ?? '#665200';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const destination = await resolveAppRoute(Boolean(user));
      const onTabs = destination === '/(tabs)';

      if (!onTabs) {
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

  const uniqueActivities = useMemo(
    () => new Set(trials.map((t) => t.activity)).size,
    [trials]
  );
  const totalAttempts = trials.length;

  const featuredActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    ACTIVITY_KEYS.forEach((key) => {
      counts[key] = 0;
    });
    trials.forEach((t) => {
      if (counts[t.activity] !== undefined) {
        counts[t.activity]++;
      }
    });
    const least = Object.entries(counts).sort((a, b) => a[1] - b[1])[0];
    return least?.[0] ?? 'parachute';
  }, [trials]);

  const missionHeadline = MISSION_HEADLINE[featuredActivity] ?? MISSION_HEADLINE.parachute;
  const missionIcon = MISSION_ICON[featuredActivity] ?? MISSION_ICON.parachute;
  const missionHook = MISSION_HOOK[featuredActivity] ?? MISSION_HOOK.parachute;
  const missionRoute = MISSION_ROUTE[featuredActivity] ?? MISSION_ROUTE.parachute;

  const teamInitial = (team?.name?.trim().charAt(0) || 'T').toUpperCase();
  const yearLabel = team?.yearLevel ?? team?.grade ?? '—';

  const completedActivities = useMemo(() => {
    const done = new Set<string>();
    trials.forEach((t) => done.add(t.activity));
    return done;
  }, [trials]);

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.xxl + 80 },
      ]}>
      <View
        style={[
          styles.headerRow,
          { paddingTop: insets.top + Spacing.md, paddingHorizontal: Spacing.lg },
        ]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: primary }]}>
            <Text style={[styles.avatarLetter, { color: textInverse }]}>{teamInitial}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: text }]}>
              Hey, {team?.name || 'Team'}
            </Text>
            <Text style={[styles.greetingSub, { color: textSecondary }]}>
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

      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: cardLavender,
            shadowColor: shadow,
          },
          Shadow.lg,
        ]}>
        <View style={[styles.missionBadge, { backgroundColor: primarySoft }]}>
          <Text style={[styles.missionBadgeText, { color: primary }]}>THIS WEEK&apos;S MISSION</Text>
        </View>

        <Text style={[styles.heroStream, { color: text }]}>{missionHeadline.stream}</Text>
        <Text style={[styles.heroAction, { color: text }]}>
          <Text style={[styles.heroActionHighlight, { backgroundColor: warning, color: text }]}>
            {missionHeadline.action}
          </Text>
        </Text>

        <Text style={[styles.heroHook, { color: textSecondary }]}>{missionHook}</Text>

        <View style={styles.heroFooter}>
          <View style={styles.iconTile}>
            <MaterialIcons name={missionIcon} size={28} color={primary} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start mission"
            onPress={() => router.push(missionRoute)}
            style={[styles.startBtn, { backgroundColor: primary }]}>
            <Text style={[styles.startBtnText, { color: textInverse }]}>Start →</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.statRow, { paddingHorizontal: Spacing.lg }]}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: cardMint, shadowColor: shadow },
            Shadow.sm,
          ]}>
          <View style={styles.statIconTile}>
            <MaterialIcons name="science" size={24} color={cardMintText} />
          </View>
          <Text style={[styles.statNumber, { color: cardMintText }]}>{uniqueActivities}</Text>
          <Text style={[styles.statUnit, { color: cardMintText }]}>experiments</Text>
          <Text style={[styles.statLabel, { color: cardMintText }]}>Lab Sessions</Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: cardYellow, shadowColor: shadow },
            Shadow.sm,
          ]}>
          <View style={styles.statIconTile}>
            <MaterialIcons name="repeat" size={24} color={cardYellowText} />
          </View>
          <Text style={[styles.statNumber, { color: cardYellowText }]}>{totalAttempts}</Text>
          <Text style={[styles.statUnit, { color: cardYellowText }]}>trials</Text>
          <Text style={[styles.statLabel, { color: cardYellowText }]}>Total Attempts</Text>
        </View>
      </View>

      <View style={[styles.catalogueSection, { paddingHorizontal: Spacing.lg }]}>
        <SectionHeading
          title="Your Activities"
          subtitle="Record · Analyse · Improve"
        />
        <View style={styles.activityList}>
          {ACTIVITIES.map((activity) => {
            const activityKey = activity.route.replace('/', '');
            return (
              <ActivityCard
                key={activity.route}
                title={activity.title}
                subtitle={activity.subtitle}
                colour={activity.colour}
                badge={activity.badge}
                completed={completedActivities.has(activityKey)}
                onPress={() => router.push(activity.route as Href)}
              />
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  greetingSub: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    minHeight: 160,
    gap: Spacing.xs,
  },
  missionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  missionBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  heroStream: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
  },
  heroAction: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    marginTop: -Spacing.xs,
  },
  heroActionHighlight: {
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  heroHook: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statIconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: FontWeight.extrabold,
  },
  statUnit: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    opacity: 0.7,
    marginTop: -Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.xs,
  },
  catalogueSection: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  activityList: {
    gap: Spacing.md,
  },
});
