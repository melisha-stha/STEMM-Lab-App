import { ActivityCard } from '@/components/ui/activity-card';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatCard } from '@/components/ui/stat-card';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { resolveAppRoute } from '@/hooks/app-routing';
import { getParachuteResults, getTeamData } from '@/hooks/storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { onAuthStateChanged } from 'firebase/auth';
import { type Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [recentCount, setRecentCount] = useState(0);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');

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
    const loadRecent = async () => {
      const data = await getParachuteResults();
      setRecentCount(Array.isArray(data) ? data.length : 0);
    };
    loadTeam();
    loadRecent();
    return unsubscribe;
  }, [router]);

  const yearDisplay = team?.yearLevel
    ? `Year ${team.yearLevel}`
    : team?.grade || '—';

  const memberCount = team?.members?.length ?? 0;

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + SCREEN_BOTTOM_INSET,
        },
      ]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.greeting, { color: text }]}>
            Hey, {team?.name || 'Team'}
          </Text>
          <Text style={[styles.greetingSub, { color: textSecondary }]}>
            Ready to explore?
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How STEMM Lab works"
          onPress={() => router.push('/how-it-works' as Href)}
          style={[styles.infoBtn, { backgroundColor: surface, borderColor: border }]}>
          <MaterialIcons name="info-outline" size={22} color={primary} />
        </Pressable>
      </View>

      {team?.id ? (
        <View style={[styles.teamBadge, { backgroundColor: primarySoft }]}>
          <Text style={[styles.teamBadgeText, { color: primary }]}>
            Team ID #{team.id}
          </Text>
        </View>
      ) : null}

      <View style={styles.statRow}>
        <StatCard label="Year Level" value={yearDisplay} colour="lavender" icon="school" />
        <StatCard label="Team ID" value={team?.id ? String(team.id) : '—'} colour="pink" icon="badge" />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Saved Results"
          value={recentCount > 0 ? String(recentCount) : '0'}
          colour="mint"
          icon="history"
        />
        <StatCard
          label="Team Members"
          value={String(memberCount)}
          colour="sky"
          icon="groups"
        />
      </View>

      <Card colour="white">
        <Text style={[styles.missionTitle, { color: text }]}>Today&apos;s Lab Mission</Text>
        <Text style={[styles.missionText, { color: textSecondary }]}>
          Choose a stream, complete hands-on challenges, record results, and improve your design
          like real scientists and engineers.
        </Text>
      </Card>

      <SectionHeading title="Your Activities" subtitle="Pick a stream to see all challenges" />

      <ActivityCard
        title="Engineering Challenges"
        subtitle="Parachute, Sound, Hand Fan, Earthquake"
        colour="mint"
        badge="Engineering"
        onPress={() => router.push('/engineering' as Href)}
      />
      <ActivityCard
        title="Health and Medical Sciences"
        subtitle="Performance, Reaction, Breathing"
        colour="sky"
        badge="Health"
        onPress={() => router.push('/health' as Href)}
      />

      <SectionHeading title="Explore Challenges" subtitle="Jump straight into an activity" />

      <ActivityCard
        title="Parachute Drop"
        subtitle="Design and test a safe landing"
        colour="mint"
        onPress={() => router.push('/parachute')}
      />
      <ActivityCard
        title="Sound Pollution Hunter"
        subtitle="Measure classroom sound levels"
        colour="peach"
        onPress={() => router.push('/sound')}
      />
      <ActivityCard
        title="Earthquake Structure"
        subtitle="Test vibration resistance"
        colour="lavender"
        onPress={() => router.push('/earthquake')}
      />
      <ActivityCard
        title="Reaction Board"
        subtitle="Test speed and coordination"
        colour="yellow"
        onPress={() => router.push('/reaction' as Href)}
      />
      <ActivityCard
        title="Breathing Pace Trainer"
        subtitle="Compare breath rates"
        colour="sky"
        onPress={() => router.push('/breathing' as Href)}
      />

      <SectionHeading title="Quick Actions" />

      <ActivityCard
        title="Leaderboard"
        subtitle="See how teams compare"
        colour="pink"
        badge="Ranks"
        onPress={() => router.push('/leaderboard')}
      />
      <ActivityCard
        title="Results"
        subtitle="Review attempts and reflections"
        colour="lavender"
        onPress={() => router.push('/results')}
      />
      <ActivityCard
        title="Drop Site Map"
        subtitle="View GPS-tagged trial locations"
        colour="yellow"
        onPress={() => router.push('/map')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
  },
  greetingSub: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
  },
  infoBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  teamBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  missionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  missionText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
  },
});
