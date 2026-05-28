import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { getTeamData, savePerformanceResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

interface PerformanceAttempt {
  memberName: string;
  movement: string;
  peakForce: number;
  averageForce: number;
  durationSec: number;
}

const parseAttempts = (attemptsJson: string | string[] | undefined): PerformanceAttempt[] => {
  if (!attemptsJson || Array.isArray(attemptsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(attemptsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is PerformanceAttempt =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as PerformanceAttempt).movement === 'string' &&
        typeof (item as PerformanceAttempt).averageForce === 'number'
    );
  } catch {
    return [];
  }
};

export default function PerformanceResultsScreen() {
  const router = useRouter();
  const { attemptsJson } = useLocalSearchParams<{ attemptsJson?: string }>();

  const attempts = useMemo(() => parseAttempts(attemptsJson), [attemptsJson]);
  
  const bestScore = useMemo(() => {
    if (!attempts.length) return null;
    return Math.min(...attempts.map((a) => a.averageForce));
  }, [attempts]);

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');

  const getScoreLabel = (avg: number): { label: string; color: string } => {
    if (avg < 0.15) return { label: 'Excellent — Very smooth', color: '#4CAF50' };
    if (avg < 0.35) return { label: 'Good — Moderate control', color: '#FF9800' };
    return { label: 'Needs practice — Shaky movement', color: '#FF4444' };
  };

  const handleSubmit = async (): Promise<void> => {
    if (!attempts.length) {
      Alert.alert('No attempts found', 'Please return and complete a movement testing matrix routine.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Reflection Required', 'Please enter a note describing your movement stability analysis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      
      if (typeof savePerformanceResults === 'function') {
        await savePerformanceResults({
          activity: 'performance',
          createdAt: Date.now(),
          attempts,
          bestAverageForce: bestScore,
          comment: reflection.trim(),
          teamName: team?.name ?? '—',
          teamId: team?.id ?? null,
          grade: team?.grade ?? '—',
        });
      }
      
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Storage Error', 'Could not commit results to device cache pipelines.');
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
        <Text style={[styles.title, { color: text }]}>Biomechanics Results</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Review acceleration deviations and evaluate neuromuscular motion stability.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Completed Movements</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>No motion logs detected inside parameters.</Text>
        ) : (
          <View style={styles.listContainer}>
            {attempts.map((item, index) => {
              const scorePresentation = getScoreLabel(item.averageForce);
              const isBest = bestScore !== null && item.averageForce === bestScore;
              return (
                <View key={index} style={[styles.attemptCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={styles.cardLeft}>
                    <Text style={[styles.cardTitle, { color: text }]}>{item.movement}</Text>
                    <Text style={[styles.cardMetrics, { color: mutedText }]}>
                      Avg: {item.averageForce} g | Peak: {item.peakForce} g | Time: {item.durationSec}s
                    </Text>
                    <Text style={[styles.statusLabel, { color: scorePresentation.color }]}>
                      {scorePresentation.label}
                    </Text>
                  </View>
                  {isBest && (
                    <View style={styles.bestBadge}>
                      <Text style={[styles.bestBadgeText, { color: primary }]}>Smoothest</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Biomechanical Evaluation</Text>
        <Text style={[styles.help, { color: mutedText }]}>What body posture factors allowed your muscles to track cleanly and smoothly?</Text>
        <Input
          label="Coordination Comment"
          placeholder="e.g. slowing joint acceleration down allowed motor neuron feedback loops to continuously correct vector deviations..."
          value={reflection}
          onChangeText={setReflection}
          multiline
          textAlignVertical="top"
          style={styles.reflectionInput}
        />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton 
          label={isSubmitting ? 'Syncing...' : 'Submit Diagnostics'} 
          onPress={handleSubmit} 
          disabled={isSubmitting || attempts.length === 0 || !reflection.trim()} 
        />
        <PrimaryButton 
          label="Back to dashboard" 
          variant="secondary" 
          onPress={() => router.replace('/(tabs)')} 
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  placeholder: { ...Typography.body, fontSize: 13, fontStyle: 'italic' },
  listContainer: { gap: Spacing.sm },
  attemptCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { gap: 2, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMetrics: { fontSize: 12 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  bestBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.03)' },
  bestBadgeText: { fontSize: 10, fontWeight: '800' },
  help: { ...Typography.body, fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
  reflectionInput: { minHeight: 120, paddingTop: Spacing.sm },
  actions: { gap: Spacing.sm },
});