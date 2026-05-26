import { PixelBox } from '@/components/ui/pixel-box';
import { PixelButton } from '@/components/ui/pixel-button';
import { PixelChoiceButton } from '@/components/ui/pixel-choice-button';
import { PixelHeading } from '@/components/ui/pixel-heading';
import { PixelText } from '@/components/ui/pixel-text';
import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UPPER_YEARS = ['4', '5', '6'] as const;
const LOWER_YEARS = ['7', '8', '9'] as const;

export default function SetupYearScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { level } = useLocalSearchParams<{ level?: string }>();
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const isDark = colorScheme === 'dark';
  const pixelShadow = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const helperBg = isDark ? '#1C1C1E' : PIXEL_BRAND.purpleSoft;
  const helperBorder = isDark ? '#9CA3AF' : PIXEL_BRAND.purpleBorder;

  const years = useMemo(
    () => (level === 'lower_secondary' ? LOWER_YEARS : UPPER_YEARS),
    [level]
  );

  const learningLevel = level === 'lower_secondary' ? 'lower_secondary' : 'upper_primary';
  const hasSelection = selectedYear !== null;

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

      <PixelText variant="step" style={styles.stepLabel}>
        step 2 of 3
      </PixelText>

      <View style={styles.headingBlock}>
        <PixelHeading align="left">select your year level</PixelHeading>
        <PixelText style={styles.subtitle}>
          this helps stemm lab show the right level of explanation.
        </PixelText>
      </View>

      <View style={styles.yearList}>
        {years.map((year, index) => (
          <PixelChoiceButton
            key={year}
            label={`year ${year}`}
            variant={index === 0 ? 'primary' : 'secondary'}
            selected={selectedYear === year}
            hasSelection={hasSelection}
            onPress={() => setSelectedYear(year)}
            style={index < years.length - 1 ? styles.yearSpacing : undefined}
          />
        ))}
      </View>

      <PixelBox shadowColor={pixelShadow} style={styles.helperOuter}>
        <View style={[styles.helperBox, { backgroundColor: helperBg, borderColor: helperBorder }]}>
          <PixelText variant="caption">
            younger students focus on observation and simple measurements. older students also
            see deeper science calculations.
          </PixelText>
        </View>
      </PixelBox>

      <PixelButton
        label="continue"
        disabled={!selectedYear}
        onPress={() =>
          router.push(`/setup-team?level=${learningLevel}&year=${selectedYear ?? ''}` as Href)
        }
        style={styles.continueBtn}
      />
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
  stepLabel: {
    marginTop: Spacing.xs,
  },
  headingBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  subtitle: {
    marginTop: -4,
  },
  yearList: {
    marginTop: Spacing.sm,
    width: '100%',
  },
  yearSpacing: {
    marginBottom: 12,
  },
  helperOuter: {
    width: '100%',
  },
  helperBox: {
    borderRadius: 8,
    borderWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  continueBtn: {
    marginTop: Spacing.sm,
  },
});
