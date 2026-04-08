import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/ui/activity-card';
import { InfoRow } from '@/components/ui/info-row';
import { SectionCard } from '@/components/ui/section-card';
import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getParachuteResults, getTeamData } from '../../hooks/storage';

interface TeamData {
  name: string;
  id: number;
  members: string[];
  grade: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');

  useEffect(() => {
    const loadTeam = async () => {
      const data = await getTeamData();
      setTeam(data);
    };
    const loadRecent = async () => {
      const data = await getParachuteResults();
      setRecent(Array.isArray(data) ? data.slice(0, 3) : []);
    };
    loadTeam();
    loadRecent();
  }, []);

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: text }]}>STEMM Lab</Text>
        <Text style={[styles.heroSubtitle, { color: mutedText }]}>
          School-friendly STEMM challenges for teams
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.cardHeader, { color: text }]}>Your Team</Text>
        <InfoRow label="Team" value={team?.name || '—'} />
        <InfoRow label="Team ID" value={team?.id ? String(team.id) : '—'} />
        <InfoRow label="Grade" value={team?.grade || '—'} />
        <Text style={[styles.cardNote, { color: mutedText }]}>
          Saved locally on this device.
        </Text>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.cardHeader, { color: text }]}>Project Concept</Text>
        <Text style={[styles.paragraph, { color: mutedText }]}>
          STEMM Lab is a collection of short, hands-on challenges that feel like real-world STEMM work:
          you plan, test, record results, and compare outcomes across attempts.
        </Text>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.cardHeader, { color: text }]}>How it works</Text>
        <View style={[styles.step, { borderTopColor: border }]}>
          <Text style={[styles.stepTitle, { color: text }]}>1) Set up your team</Text>
          <Text style={[styles.stepBody, { color: mutedText }]}>
            Enter your team name, at least one member, and grade on the Setup screen.
          </Text>
        </View>
        <View style={[styles.step, { borderTopColor: border }]}>
          <Text style={[styles.stepTitle, { color: text }]}>2) Choose a challenge</Text>
          <Text style={[styles.stepBody, { color: mutedText }]}>
            Each activity gives you clear instructions and a built-in tool (like a timer) to capture data.
          </Text>
        </View>
        <View style={[styles.step, { borderTopColor: border }]}>
          <Text style={[styles.stepTitle, { color: text }]}>3) Run multiple trials</Text>
          <Text style={[styles.stepBody, { color: mutedText }]}>
            Record multiple attempts (e.g., 3 drops), then compare the results to spot patterns and improve
            your design.
          </Text>
        </View>
        <View style={[styles.stepLast, { borderTopColor: border }]}>
          <Text style={[styles.stepTitle, { color: text }]}>4) Reflect & iterate</Text>
          <Text style={[styles.stepBody, { color: mutedText }]}>
            Use your results to explain what changed and why. (We can add graphs and saved history next.)
          </Text>
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.cardHeader, { color: text }]}>Available Activities</Text>
        <ActivityCard
          title="Activity 1: Parachute Drop"
          tag="Engineering • Physics"
          description="Drop a toy from a consistent height, time the fall, and compare results across attempts."
          onPress={() => router.push('/parachute')}
        />
      </SectionCard>

      <SectionCard>
        <Text style={[styles.cardHeader, { color: text }]}>Recent Results</Text>
        {recent.length === 0 ? (
          <Text style={[styles.paragraph, { color: mutedText }]}>
            No submissions yet. Complete Parachute Drop and submit results to see them here.
          </Text>
        ) : (
          <View style={[styles.recentWrap, { borderTopColor: border }]}>
            {recent.map((r, idx) => (
              <View key={`${r.createdAt ?? idx}`} style={styles.recentRow}>
                <Text style={[styles.recentTeam, { color: text }]} numberOfLines={1}>
                  {r.teamName ?? 'Team'}
                </Text>
                <Text style={[styles.recentScore, { color: mutedText }]}>
                  Best: {typeof r.bestAttempt === 'number' ? `${(r.bestAttempt / 1000).toFixed(2)}s` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ marginTop: Spacing.sm }}>
          <ActivityCard
            title="View Leaderboard"
            tag="Rankings"
            description="See how teams compare on Parachute Drop."
            cta="Open leaderboard"
            onPress={() => router.push('/leaderboard')}
          />
        </View>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },

  hero: {
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  heroTitle: { ...Typography.hero },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body },

  cardHeader: { ...Typography.section, marginBottom: Spacing.sm },
  cardNote: { marginTop: Spacing.sm, ...Typography.small },

  paragraph: { ...Typography.body },

  recentWrap: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  recentTeam: { ...Typography.body, fontSize: 13, flex: 1 },
  recentScore: { ...Typography.small },

  step: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  stepLast: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  stepTitle: { ...Typography.section, fontSize: 14 },
  stepBody: { marginTop: Spacing.xs, ...Typography.body, fontSize: 13, lineHeight: 19 },
});