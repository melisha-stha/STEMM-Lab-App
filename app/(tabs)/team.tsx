import { InfoRow } from '@/components/ui/info-row';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { clearTeamData, getTeamData } from '@/hooks/storage';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TeamTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [team, setTeam] = useState<{
    name: string;
    id: number;
    members: string[];
    grade: string;
    yearLevel?: string;
    learningLevel?: string;
  } | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');

  useEffect(() => {
    void getTeamData().then(setTeam);
  }, []);

  const handleResetTeam = () => {
    const performClear = async () => {
      await clearTeamData();
      router.replace('/welcome-screen' as Href);
    };

    if (Platform.OS === 'web') {
      const ok = globalThis.confirm?.('Reset team setup on this device?');
      if (ok) void performClear();
      return;
    }

    Alert.alert('Reset team?', 'This clears local team setup on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void performClear() },
    ]);
  };

  const yearDisplay = team?.yearLevel ? `Year ${team.yearLevel}` : team?.grade || '—';
  const levelDisplay =
    team?.learningLevel === 'lower_secondary'
      ? 'Lower Secondary'
      : team?.learningLevel === 'upper_primary'
        ? 'Upper Primary'
        : '—';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top']}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(Spacing.sm, insets.top + Spacing.sm) },
        ]}>
        <Text style={[styles.title, { color: text }]}>Your Team</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Team details are saved locally on this device.
        </Text>

        <SectionCard>
          <InfoRow label="Team name" value={team?.name || '—'} />
          <InfoRow label="Team ID" value={team?.id ? String(team.id) : '—'} />
          <InfoRow label="Year level" value={yearDisplay} />
          <InfoRow label="Learning level" value={levelDisplay} />
          <InfoRow label="Members" value={team?.members?.length ? team.members.join(', ') : '—'} />
        </SectionCard>

        <PrimaryButton label="Reset team setup" variant="danger" onPress={handleResetTeam} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  title: {
    ...Typography.hero,
    fontSize: 26,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
