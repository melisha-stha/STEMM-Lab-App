import { Radius, Spacing, Typography } from '@/constants/design';
import { formatLocaleDateTime } from '@/utils/formatters/date';
import {
  formatLabJournalSavedAt,
  getActivityDisplayName,
  type LabJournalEntry,
} from '@/utils/formatters/lab-journal';
import { withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export type TeamTrialRow = {
  id: number;
  teamName?: string;
  activity?: string;
  time?: number;
  createdAt?: string;
};

function formatTrialSummary(activity: string, time: number | undefined): string {
  const value = Number(time);
  if (!Number.isFinite(value)) return 'Result recorded';
  switch (activity) {
    case 'parachute':
      return `${(value / 1000).toFixed(2)} s drop`;
    case 'sound':
      return `${value} dB peak`;
    case 'earthquake':
      return `${value}/100 score`;
    case 'reaction':
      return `${value} ms`;
    case 'breathing':
      return `${value} BPM`;
    case 'handfan':
      return `${value} N`;
    case 'performance':
      return `Metric ${value}`;
    default:
      return String(value);
  }
}

type JournalListItem =
  | { kind: 'reflection'; sortAt: number; entry: LabJournalEntry }
  | { kind: 'trial'; sortAt: number; trial: TeamTrialRow };

type LabJournalSectionProps = {
  entries: LabJournalEntry[];
  trials: TeamTrialRow[];
  loading: boolean;
  pixelFontLoaded: boolean;
  pixelFamily: string | null | undefined;
  borderColor: string;
  cardBackground: string;
  cardBorder: string;
  cardShadow: string;
  accentColor: string;
};

export function LabJournalSection({
  entries,
  trials,
  loading,
  pixelFontLoaded,
  pixelFamily,
  borderColor,
  cardBackground,
  cardBorder,
  cardShadow,
  accentColor,
}: LabJournalSectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const ink = accentColor;
  const inkMuted = accentColor;
  const quoteSurface = 'rgba(255, 255, 255, 0.92)';
  const totalCount = entries.length + trials.length;

  const sortedItems = useMemo((): JournalListItem[] => {
    const items: JournalListItem[] = entries.map((entry) => ({
      kind: 'reflection',
      sortAt: entry.createdAt,
      entry,
    }));
    for (const trial of trials) {
      const parsed = trial.createdAt ? Date.parse(trial.createdAt) : NaN;
      items.push({
        kind: 'trial',
        sortAt: Number.isFinite(parsed) ? parsed : 0,
        trial,
      });
    }
    return items.sort((a, b) => b.sortAt - a.sortAt);
  }, [entries, trials]);

  const toggleTitle =
    pixelFontLoaded && pixelFamily ? (
      <Text style={withPixelFontStyle(pixelFamily, styles.toggleTitle, { color: ink })}>
        Lab Journal
      </Text>
    ) : (
      <Text style={[styles.toggleTitle, { color: ink }]}>Lab Journal</Text>
    );

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Lab Journal"
        accessibilityHint={
          expanded ? 'Collapse lab journal' : 'Expand to view reflections and saved attempts'
        }
        onPress={() => setExpanded((prev) => !prev)}
        style={({ pressed }) => [
          styles.toggleCard,
          {
            backgroundColor: cardBackground,
            borderColor: cardBorder,
            borderBottomColor: cardShadow,
            opacity: pressed ? 0.92 : 1,
          },
        ]}>
        <View style={styles.toggleRow}>
          <MaterialIcons name="menu-book" size={24} color={ink} />
          <View style={styles.toggleTextBlock}>
            {toggleTitle}
            <Text style={[styles.toggleHint, { color: inkMuted, opacity: 0.85 }]}>
              {expanded
                ? 'Tap to hide — tap any row for full details'
                : 'Reflections and saved attempts in one place'}
            </Text>
          </View>
          {totalCount > 0 ? (
            <View style={[styles.countBadge, { borderColor: cardBorder, backgroundColor: quoteSurface }]}>
              <Text style={[styles.countBadgeText, { color: ink }]}>{totalCount}</Text>
            </View>
          ) : null}
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={28} color={ink} />
        </View>
      </Pressable>

      {expanded ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: cardBackground,
              borderColor: cardBorder,
              borderBottomColor: cardShadow,
            },
          ]}>
          <Text style={[styles.subtitle, { color: ink, opacity: 0.9 }]}>
            Your team&apos;s reflections and device-saved activity attempts. Tap a row to open full
            results.
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={ink} style={styles.loader} />
          ) : sortedItems.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: quoteSurface,
                  borderColor: cardBorder,
                },
              ]}>
              <Text style={[styles.emptyTitle, { color: ink }]}>Nothing saved yet</Text>
              <Text style={[styles.emptyBody, { color: ink, opacity: 0.85 }]}>
                Complete an activity, save your results, and add a reflection to see entries here.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {sortedItems.map((item) => {
                if (item.kind === 'reflection') {
                  const { entry } = item;
                  const savedLabel = formatLabJournalSavedAt(entry.createdAt);
                  return (
                    <Pressable
                      key={`reflection-${entry.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${entry.activityName} reflection`}
                      onPress={() =>
                        router.push({
                          pathname: '/lab-journal-detail' as any,
                          params: {
                            mode: 'reflection',
                            activityKey: entry.activityKey,
                            createdAt: String(entry.createdAt),
                          },
                        })
                      }
                      style={({ pressed }) => [
                        styles.entryCard,
                        {
                          backgroundColor: quoteSurface,
                          borderColor: cardBorder,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}>
                      <View style={styles.entryHeader}>
                        <View style={[styles.kindPill, { borderColor: cardBorder }]}>
                          <Text style={[styles.kindPillText, { color: ink }]}>Reflection</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={ink} />
                      </View>
                      <Text style={[styles.activityLabel, { color: ink }]}>{entry.activityName}</Text>
                      {savedLabel ? (
                        <Text style={[styles.metaLine, { color: ink, opacity: 0.85 }]}>{savedLabel}</Text>
                      ) : null}
                      <Text style={[styles.summaryLine, { color: ink }]}>{entry.resultSummary}</Text>
                      <View style={[styles.quoteBlock, { borderLeftColor: cardBorder }]}>
                        <Text style={[styles.commentText, { color: ink }]} numberOfLines={4}>
                          {entry.reflectionText}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }

                const { trial } = item;
                const activity = String(trial.activity ?? '');
                const parsedAt = trial.createdAt ? Date.parse(trial.createdAt) : NaN;
                const savedAt = Number.isFinite(parsedAt) ? formatLocaleDateTime(parsedAt) : null;
                return (
                  <Pressable
                    key={`trial-${trial.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${getActivityDisplayName(activity)} attempt`}
                    onPress={() =>
                      router.push({
                        pathname: '/lab-journal-detail' as any,
                        params: { mode: 'trial', trialId: String(trial.id) },
                      })
                    }
                    style={({ pressed }) => [
                      styles.entryCard,
                      {
                        backgroundColor: quoteSurface,
                        borderColor: cardBorder,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <View style={styles.entryHeader}>
                      <View style={[styles.kindPill, { borderColor: cardBorder }]}>
                        <Text style={[styles.kindPillText, { color: ink }]}>Saved attempt</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={ink} />
                    </View>
                    <Text style={[styles.activityLabel, { color: ink }]}>
                      {getActivityDisplayName(activity)}
                    </Text>
                    {savedAt ? (
                      <Text style={[styles.metaLine, { color: ink, opacity: 0.85 }]}>{savedAt}</Text>
                    ) : null}
                    <Text style={[styles.summaryLine, { color: ink }]}>
                      {formatTrialSummary(activity, trial.time)}
                    </Text>
                    <Text style={[styles.teamLine, { color: ink, opacity: 0.85 }]}>
                      Synced on this device · tap for GPS and video details
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={[styles.privacyNote, { color: ink, opacity: 0.85, borderTopColor: cardBorder }]}>
            Only this team&apos;s records on this device are shown.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  toggleCard: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  toggleTitle: {
    ...Typography.section,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  toggleHint: {
    ...Typography.small,
    lineHeight: 18,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  panel: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  subtitle: {
    ...Typography.small,
    lineHeight: 18,
  },
  loader: {
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  emptyState: {
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    ...Typography.section,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  emptyBody: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  list: {
    gap: Spacing.sm,
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  kindPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  metaLine: {
    ...Typography.small,
    fontSize: 12,
  },
  summaryLine: {
    ...Typography.small,
    fontSize: 13,
    fontWeight: '800',
  },
  quoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    marginTop: 4,
  },
  commentText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  teamLine: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  privacyNote: {
    ...Typography.small,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
});
