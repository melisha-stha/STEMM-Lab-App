import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UPPER_YEARS = ['4', '5', '6'] as const;
const LOWER_YEARS = ['7', '8', '9'] as const;

export default function SetupYearScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { level } = useLocalSearchParams<{ level?: string }>();
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const textInverse = useThemeColor({}, 'textInverse');

  const years = useMemo(
    () => (level === 'lower_secondary' ? LOWER_YEARS : UPPER_YEARS),
    [level]
  );

  const learningLevel = level === 'lower_secondary' ? 'lower_secondary' : 'upper_primary';

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl },
      ]}>
      <TouchableOpacity
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={[styles.stepPill, { backgroundColor: primarySoft }]}>
        <Text style={[styles.stepText, { color: primary }]}>Step 2 of 3</Text>
      </View>

      <SectionHeading
        title="Select your year level"
        subtitle="This helps STEMM Lab show the right level of explanation."
      />

      <View style={styles.yearGrid}>
        {years.map((year) => {
          const isSelected = selectedYear === year;
          return (
            <Card
              key={year}
              colour="sky"
              selected={isSelected}
              onPress={() => setSelectedYear(year)}
              style={styles.yearCard}>
              <Text style={[styles.yearText, { color: text }]}>Year {year}</Text>
            </Card>
          );
        })}
      </View>

      <Card colour="lavender">
        <Text style={[styles.helperText, { color: textSecondary }]}>
          For younger students, the app focuses on observation and simple measurements. For older
          students, it also shows deeper science calculations.
        </Text>
      </Card>

      <TouchableOpacity
        accessibilityRole="button"
        disabled={!selectedYear}
        onPress={() =>
          router.push(`/setup-team?level=${learningLevel}&year=${selectedYear ?? ''}` as Href)
        }
        style={[
          styles.continueBtn,
          { backgroundColor: primary, opacity: selectedYear ? 1 : 0.45 },
        ]}>
        <Text style={[styles.continueText, { color: textInverse }]}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  stepText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  yearCard: {
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  yearText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  helperText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
  },
  continueBtn: {
    marginTop: Spacing.sm,
    minHeight: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
