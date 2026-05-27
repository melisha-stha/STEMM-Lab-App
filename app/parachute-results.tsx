import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { getTeamData, saveParachuteResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ParachuteCalculations {
  finalVelocity: number;
  acceleration: number;
  netForce: number;
  weight: number;
  dragForce: number;
}

interface ParachuteAttempt {
  dropTimeSec: number;
  contactTimeSec: number;
  bounced: boolean;
  bounceTimeSec: number | null;
  videoUri: string | null;
  calculations: ParachuteCalculations;
  gForce: number;
  massKg: number;
  heightM: number;
}

const getGForceRiskColor = (g: number, success: string, warning: string, error: string): string => {
  if (g <= 5) return success;
  if (g <= 10) return warning;
  return error;
};

const parseAttempts = (attemptsJson: string | string[] | undefined): ParachuteAttempt[] => {
  if (!attemptsJson || Array.isArray(attemptsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(attemptsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is ParachuteAttempt =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ParachuteAttempt).dropTimeSec === 'number' &&
        typeof (item as ParachuteAttempt).gForce === 'number'
    );
  } catch {
    return [];
  }
};

export default function ParachuteResultsScreen() {
  const router = useRouter();
  const { attemptsJson } = useLocalSearchParams<{ attemptsJson?: string }>();

  const attempts = useMemo(() => parseAttempts(attemptsJson), [attemptsJson]);
  const bestAttempt = useMemo(() => {
    if (!attempts.length) return null;
    return attempts.reduce((best, a) => (a.dropTimeSec > best.dropTimeSec ? a : best));
  }, [attempts]);

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const warning = useThemeColor({}, 'warning' as any) ?? '#FF9800';
  const error = useThemeColor({}, 'error' as any) ?? '#F44336';

  const handleSubmit = async (): Promise<void> => {
    if (!attempts.length) {
      Alert.alert('No attempts found', 'Please return and complete a trial execution sequence first.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Reflection Required', 'Please detail how your layout configuration adjustments minimized impact forces.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      await saveParachuteResults({
        activity: 'parachute',
        createdAt: Date.now(),
        attempts,
        bestTime: bestAttempt?.dropTimeSec ?? 0,
        comment: reflection.trim(),
        teamName: team?.name ?? '—',
        teamId: team?.id ?? null,
        grade: team?.grade ?? '—',
      });
      router.replace('/(tabs)');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Parachute Drop Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review engineering math outputs across layout trials and log group reflection summaries.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Logged Prototypes</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>No baseline or custom prototype assets transmitted.</Text>
        ) : (
          <View style={styles.listContainer}>
            {attempts.map((item, index) => {
              const isBest = bestAttempt !== null && item.dropTimeSec === bestAttempt.dropTimeSec;
              const gColor = getGForceRiskColor(item.gForce, success, warning, error);
              return (
                <View key={index} style={[styles.attemptCard, { backgroundColor: card, borderColor: isBest ? success : border }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.cardTitle, { color: text }]}>Prototype Attempt {index + 1}</Text>
                    <Text style={[styles.body, { color: mutedText }]}>Air Time: {item.dropTimeSec}s | Term Vel: {item.calculations.finalVelocity} m/s</Text>
                    <Text style={[styles.body, { color: mutedText, fontSize: 11 }]}>Drag Force: {item.calculations.dragForce} N vs Down Weight: {item.calculations.weight} N</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={[styles.gValueText, { color: gColor }]}>{item.gForce} g</Text>
                    {isBest && (
                      <View style={[styles.bestBadge, { backgroundColor: success }]}>
                        <Text style={styles.bestBadgeText}>Best Time</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Engineering Reflections</Text>
        <Text style={[styles.help, { color: mutedText }]}>How did canopy design surface alterations change deceleration dynamics?</Text>
        <Input
          label="Commentary Analysis"
          placeholder="e.g. increasing canopy area captured greater drag vectors which delayed acceleration metrics..."
          value={reflection}
          onChangeText={setReflection}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 100, paddingTop: Spacing.sm }}
        />
      </SectionCard>

      <View style={{ gap: Spacing.sm }}>
        <PrimaryButton label={isSubmitting ? 'Syncing...' : 'Submit Evaluation Report'} onPress={handleSubmit} disabled={isSubmitting || attempts.length === 0 || !reflection.trim()} />
        <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 24 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body, fontSize: 13, lineHeight: 18 },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  placeholder: { ...Typography.body, fontSize: 13, fontStyle: 'italic' },
  listContainer: { gap: Spacing.sm },
  attemptCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12 },
  gValueText: { fontSize: 20, fontWeight: '900', fontFamily: 'monospace' },
  bestBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  bestBadgeText: { fontSize: 9, fontWeight: '800', color: '#000000' },
  help: { fontSize: 13, marginBottom: Spacing.xs }
});