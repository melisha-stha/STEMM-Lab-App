import { LabJournalDetailBody } from '@/components/team/LabJournalDetailBody';
import { InfoRow } from '@/components/ui/info-row';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { Radius, Spacing, Typography } from '@/constants/design';
import { getTrials } from '@/hooks/database';
import { getTeamData } from '@/hooks/storage';
import { useScreenScrollInsets } from '@/hooks/use-screen-scroll-insets';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  formatLabJournalSavedAt,
  getActivityDisplayName,
  loadSavedReflectionPayload,
} from '@/utils/formatters/lab-journal';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TrialRow = {
  id: number;
  teamName?: string;
  activity?: string;
  time?: number;
  videoUri?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

function formatTrialMetric(activity: string, time: number | undefined): string {
  const value = Number(time);
  if (!Number.isFinite(value)) return '—';
  switch (activity) {
    case 'parachute':
      return `${(value / 1000).toFixed(2)} s drop time`;
    case 'sound':
      return `${value} dB peak (estimated)`;
    case 'earthquake':
      return `${value}/100 stability score`;
    case 'reaction':
      return `${value} ms reaction`;
    case 'breathing':
      return `${value} BPM at rest`;
    case 'handfan':
      return `${value} N peak force`;
    case 'performance':
      return `Smoothness metric ${value}`;
    default:
      return String(value);
  }
}

export default function LabJournalDetailScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    activityKey?: string;
    createdAt?: string;
    trialId?: string;
  }>();

  const mode = params.mode === 'trial' ? 'trial' : 'reflection';
  const activityKey = String(params.activityKey ?? '');
  const createdAt = Number(params.createdAt);
  const trialId = Number(params.trialId);

  const [loading, setLoading] = useState(true);
  const [reflectionPayload, setReflectionPayload] = useState<Record<string, unknown> | null>(null);
  const [trial, setTrial] = useState<TrialRow | null>(null);

  const background = useThemeColor({}, 'background');
  const pageText = useThemeColor({}, 'text');
  const pageMuted = useThemeColor({}, 'mutedText');
  const panelInk = useThemeColor({}, 'cardLavenderText');
  const border = useThemeColor({}, 'cardLavenderBorder');
  const panelBg = useThemeColor({}, 'cardLavender');
  const innerCard = 'rgba(255, 255, 255, 0.92)';
  const { scrollContentStyle } = useScreenScrollInsets();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        if (mode === 'trial') {
          const rows = getTrials();
          const match = rows.find((row) => Number((row as TrialRow).id) === trialId) as TrialRow | undefined;
          if (!cancelled) {
            setTrial(match ?? null);
            setReflectionPayload(null);
          }
          return;
        }

        const team = await getTeamData();
        const payload = await loadSavedReflectionPayload(
          activityKey,
          createdAt,
          team?.name,
          team?.id ?? null
        );
        if (!cancelled) {
          setReflectionPayload(payload);
          setTrial(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, activityKey, createdAt, trialId]);

  const title = useMemo(() => {
    if (mode === 'trial' && trial?.activity) {
      return getActivityDisplayName(String(trial.activity));
    }
    if (activityKey) return getActivityDisplayName(activityKey);
    return 'Lab record';
  }, [mode, trial, activityKey]);

  const savedLabel = useMemo(() => {
    if (mode === 'trial' && trial?.createdAt) {
      const parsed = Date.parse(trial.createdAt);
      return Number.isFinite(parsed) ? formatLabJournalSavedAt(parsed) : trial.createdAt;
    }
    if (Number.isFinite(createdAt)) return formatLabJournalSavedAt(createdAt);
    return null;
  }, [mode, trial, createdAt]);

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, scrollContentStyle]}>
        <ScreenBackButton />

        <View style={styles.header}>
          <Text style={[styles.title, { color: pageText }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: pageMuted }]}>
            {mode === 'trial'
              ? 'Local attempt saved on this device during upload.'
              : 'Saved reflection and results from your team lab journal.'}
          </Text>
          {savedLabel ? (
            <Text style={[styles.meta, { color: pageMuted }]}>Saved {savedLabel}</Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={pageText} />
        ) : mode === 'trial' ? (
          trial ? (
            <View style={[styles.panel, { backgroundColor: panelBg, borderColor: border }]}>
              <InfoRow
                label="Activity"
                value={getActivityDisplayName(String(trial.activity ?? ''))}
                labelColor={panelInk}
                valueColor={panelInk}
                borderColor={border}
              />
              <InfoRow
                label="Team"
                value={String(trial.teamName ?? '—')}
                labelColor={panelInk}
                valueColor={panelInk}
                borderColor={border}
              />
              <InfoRow
                label="Result"
                value={formatTrialMetric(String(trial.activity ?? ''), trial.time)}
                labelColor={panelInk}
                valueColor={panelInk}
                borderColor={border}
              />
              <InfoRow
                label="Video"
                value={trial.videoUri?.trim() ? 'Attached on device' : 'No video URI stored'}
                labelColor={panelInk}
                valueColor={panelInk}
                borderColor={border}
              />
              <InfoRow
                label="Location"
                value={
                  trial.latitude != null &&
                  trial.longitude != null &&
                  (trial.latitude !== 0 || trial.longitude !== 0)
                    ? `${Number(trial.latitude).toFixed(5)}, ${Number(trial.longitude).toFixed(5)}`
                    : 'Not recorded'
                }
                labelColor={panelInk}
                valueColor={panelInk}
                borderColor={border}
              />
            </View>
          ) : (
            <Text style={[styles.empty, { color: pageMuted }]}>
              This attempt could not be found on this device.
            </Text>
          )
        ) : reflectionPayload ? (
          <LabJournalDetailBody
            activityKey={activityKey}
            payload={reflectionPayload}
            textColor={panelInk}
            mutedColor={panelInk}
            borderColor={border}
            cardColor={innerCard}
          />
        ) : (
          <Text style={[styles.empty, { color: pageMuted }]}>
            This reflection could not be loaded. It may have been removed from local storage.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  header: { gap: Spacing.xs, paddingHorizontal: Spacing.xs },
  title: { ...Typography.hero, fontSize: 24 },
  subtitle: { ...Typography.body, fontSize: 13, lineHeight: 18, opacity: 0.9 },
  meta: { ...Typography.small, fontWeight: '700', opacity: 0.85 },
  panel: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 0,
  },
  loader: { marginVertical: Spacing.xl },
  empty: { ...Typography.body, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.lg },
});
