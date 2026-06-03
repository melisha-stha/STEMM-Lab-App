import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useScreenScrollInsets } from '@/hooks/use-screen-scroll-insets';
import { getTeamData, saveHandFanResults } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';

interface DesignTrial {
  memberName: string;
  designName: string;
  distance: string;
  materialLabel: string;
  kValue: number;
  bendAngleDeg: string;
  computedForceN: number | null;
  videoUri: string | null;
}

const parseAttempts = (attemptsJson: string | string[] | undefined): DesignTrial[] => {
  if (!attemptsJson || Array.isArray(attemptsJson)) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(attemptsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is DesignTrial =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as DesignTrial).designName === 'string' &&
        typeof (item as DesignTrial).bendAngleDeg === 'string'
    );
  } catch {
    return [];
  }
};

export default function HandFanResultsScreen() {
  const router = useRouter();
  const { attemptsJson } = useLocalSearchParams<{ attemptsJson?: string }>();

  const attempts = useMemo(() => parseAttempts(attemptsJson), [attemptsJson]);
  
  const maximumForceRecord = useMemo(() => {
    if (!attempts.length) return null;
    return Math.max(...attempts.map((a) => a.computedForceN || 0));
  }, [attempts]);

  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const { scrollContentStyle } = useScreenScrollInsets();

  const handleSubmit = async (): Promise<void> => {
    if (!attempts.length) {
      Alert.alert('No attempts found', 'Please return and track standard fluid dynamic attempts.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('Reflection Required', 'Please detail your findings regarding blade surface mechanics.');
      return;
    }

    setIsSubmitting(true);
    try {
      const team = await getTeamData();
      
      if (typeof saveHandFanResults === 'function') {
        await saveHandFanResults({
          activity: 'handfan',
          createdAt: Date.now(),
          attempts,
          peakForceN: maximumForceRecord,
          comment: reflection.trim(),
          teamName: team?.name ?? '—',
          teamId: team?.id ?? null,
          grade: team?.grade ?? '—',
        });
      }
      
      Alert.alert('Saved', 'Reflection saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Storage Error', 'Could not sync evaluation fields to secure application memory blocks.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, scrollContentStyle]}>
        <ScreenBackButton />
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Hand Fan Evaluation</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Analyze blade airflow drag force vectors and document your group metrics.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Logged Prototypes</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>No design records populated inside parameters.</Text>
        ) : (
          <View style={styles.listContainer}>
            {attempts.map((item, index) => {
              const isPeak = maximumForceRecord !== null && item.computedForceN === maximumForceRecord;
              return (
                <View key={index} style={[styles.attemptCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={styles.cardLeft}>
                    <Text style={[styles.cardTitle, { color: text }]}>{item.designName}</Text>
                    <Text style={[styles.cardMetrics, { color: mutedText }]}>
                      Material: {item.materialLabel} | Distance: {item.distance}
                    </Text>
                    <Text style={[styles.statusLabel, { color: mutedText }]}>
                      Deformation: {item.bendAngleDeg} degrees
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[styles.forceText, { color: isPeak ? success : primary }]}>
                      {item.computedForceN ?? 0} N
                    </Text>
                    {isPeak && (
                      <View style={[styles.peakBadge, { backgroundColor: success }]}>
                        <Text style={styles.peakBadgeText}>Max Force</Text>
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
        <Text style={[styles.sectionTitle, { color: text }]}>Fluid Dynamics Reflection</Text>
        <Text style={[styles.help, { color: mutedText }]}>Which surface geometry configuration generated the greatest kinetic air transfer?</Text>
        <Input
          label="Aerodynamic Comment"
          placeholder="e.g. expanding surface volume increased fluid mass redirection which amplified drag constants..."
          value={reflection}
          onChangeText={setReflection}
          multiline
          textAlignVertical="top"
          style={styles.reflectionInput}
        />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton 
          label={isSubmitting ? 'Syncing...' : 'Submit Evaluation'} 
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: {},
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
  statusLabel: { fontSize: 12 },
  forceText: { fontSize: 18, fontWeight: '900', fontFamily: 'monospace' },
  peakBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  peakBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  help: { ...Typography.body, fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
  reflectionInput: { minHeight: 120, paddingTop: Spacing.sm },
  actions: { gap: Spacing.sm },
});