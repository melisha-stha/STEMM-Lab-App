import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { formatLabJournalSavedAt, type LabJournalEntry } from '@/utils/formatters/lab-journal';
import { withPixelFontStyle } from '@/hooks/use-pixel-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [expanded, setExpanded] = useState(false);
  const reflectionCount = entries.length;

  const toggleTitle =
    pixelFontLoaded && pixelFamily ? (
      <Text style={withPixelFontStyle(pixelFamily, styles.toggleTitle, { color: textColor })}>
        Lab Journal — Saved reflections
      </Text>
    ) : (
      <Text style={[styles.toggleTitle, { color: textColor }]}>Lab Journal — Saved reflections</Text>
    );

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Lab Journal saved reflections"
        accessibilityHint={
          expanded ? 'Collapse saved reflections' : 'Expand to view saved reflections'
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
          <MaterialIcons name="menu-book" size={24} color={accentColor} />
          <View style={styles.toggleTextBlock}>
            {toggleTitle}
            <Text style={[styles.toggleHint, { color: mutedTextColor }]}>
              {expanded
                ? 'Tap to hide your team\'s saved reflections'
                : 'Tap to view your team\'s saved reflections'}
            </Text>
          </View>
          {reflectionCount > 0 ? (
            <View style={[styles.countBadge, { borderColor: cardBorder, backgroundColor: cardBackground }]}>
              <Text style={[styles.countBadgeText, { color: accentColor }]}>{reflectionCount}</Text>
            </View>
          ) : null}
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={28}
            color={mutedTextColor}
          />
        </View>
      </Pressable>

      {expanded ? (
        <SectionCard>
          <Text style={[styles.subtitle, { color: mutedTextColor }]}>
            Your team&apos;s saved reflections from completed activities.
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={accentColor} style={styles.loader} />
          ) : entries.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: cardBackground,
                  borderColor: cardBorder,
                  borderBottomColor: cardShadow,
                },
              ]}>
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
                    <Text style={[styles.summaryLine, { color: textColor }]}>
                      {entry.resultSummary}
                    </Text>
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
  subtitle: {
    ...Typography.small,
    lineHeight: 18,
    marginBottom: Spacing.sm,
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
