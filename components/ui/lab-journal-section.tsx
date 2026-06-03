import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { formatLabJournalSavedAt, type LabJournalEntry } from '@/hooks/lab-journal';
import { withPixelFontStyle } from '@/hooks/use-pixel-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type LabJournalSectionProps = {
  entries: LabJournalEntry[];
  loading: boolean;
  pixelFontLoaded: boolean;
  pixelFamily: string | null | undefined;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  cardBackground: string;
  cardBorder: string;
  cardShadow: string;
  accentColor: string;
};

export function LabJournalSection({
  entries,
  loading,
  pixelFontLoaded,
  pixelFamily,
  textColor,
  mutedTextColor,
  borderColor,
  cardBackground,
  cardBorder,
  cardShadow,
  accentColor,
}: LabJournalSectionProps) {
  const sectionTitle =
    pixelFontLoaded && pixelFamily ? (
      <Text style={withPixelFontStyle(pixelFamily, styles.sectionTitle, { color: textColor })}>
        Lab Journal
      </Text>
    ) : (
      <Text style={[styles.sectionTitle, { color: textColor }]}>Lab Journal</Text>
    );

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHeaderRow}>
        {sectionTitle}
        <Text style={[styles.subtitle, { color: mutedTextColor }]}>
          Your team&apos;s saved reflections from completed activities.
        </Text>
      </View>

      <SectionCard>
        {loading ? (
          <ActivityIndicator size="small" color={accentColor} style={styles.loader} />
        ) : entries.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: cardBackground, borderColor: cardBorder, borderBottomColor: cardShadow },
            ]}>
            <MaterialIcons name="menu-book" size={36} color={borderColor} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No reflections yet</Text>
            <Text style={[styles.emptyBody, { color: mutedTextColor }]}>
              Complete an activity and submit a reflection to build your team&apos;s lab journal.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry) => {
              const savedLabel = formatLabJournalSavedAt(entry.createdAt);
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.entryCard,
                    {
                      backgroundColor: cardBackground,
                      borderColor: cardBorder,
                      borderBottomColor: cardShadow,
                    },
                  ]}>
                  <View style={styles.entryHeader}>
                    <Text style={[styles.activityLabel, { color: accentColor }]}>
                      {entry.activityName}
                    </Text>
                    <View style={[styles.activityBadge, { borderColor: cardBorder }]}>
                      <Text style={[styles.activityBadgeText, { color: mutedTextColor }]}>
                        {entry.activityKey}
                      </Text>
                    </View>
                  </View>
                  {savedLabel ? (
                    <Text style={[styles.metaLine, { color: mutedTextColor }]}>{savedLabel}</Text>
                  ) : null}
                  <Text style={[styles.summaryLine, { color: textColor }]}>{entry.resultSummary}</Text>
                  <View style={[styles.quoteBlock, { borderLeftColor: accentColor }]}>
                    <Text style={[styles.commentText, { color: textColor }]}>
                      {entry.reflectionText}
                    </Text>
                  </View>
                  <Text style={[styles.teamLine, { color: mutedTextColor }]}>
                    {entry.teamName || 'Your team'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        <Text style={[styles.privacyNote, { color: mutedTextColor, borderTopColor: borderColor }]}>
          Only reflections from this team are shown on this device.
        </Text>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    gap: 6,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.section,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
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
    borderWidth: 2,
    borderBottomWidth: 4,
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
    borderWidth: 2,
    borderBottomWidth: 4,
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
  activityLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  activityBadge: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activityBadgeText: {
    ...Typography.small,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'lowercase',
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
    marginTop: 2,
  },
  commentText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
});
