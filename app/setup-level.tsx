import { Card, type CardColour } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LearningLevel = 'upper_primary' | 'lower_secondary';

type LevelOption = {
  id: LearningLevel;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  colour: CardColour;
};

const LEVEL_OPTIONS: LevelOption[] = [
  {
    id: 'upper_primary',
    title: 'Upper Primary',
    subtitle: 'Years 4 to 6',
    description: 'Simple measurements, predictions, and observations.',
    icon: 'school',
    colour: 'mint',
  },
  {
    id: 'lower_secondary',
    title: 'Lower Secondary',
    subtitle: 'Years 7 to 9',
    description: 'Forces, calculations, comparisons, and deeper analysis.',
    icon: 'science',
    colour: 'lavender',
  },
];

export default function SetupLevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<LearningLevel | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary' as any) ?? '#6E6E73';  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft' as any) ?? 'rgba(0, 122, 255, 0.1)';
  const textInverse = useThemeColor({}, 'textInverse' as any) ?? '#FFFFFF';

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
        <Text style={[styles.stepText, { color: primary }]}>Step 1 of 3</Text>
      </View>

      <SectionHeading
        title="Choose your learning level"
        subtitle="We will adjust the activity language and challenge style for your class."
      />

      <View style={styles.cardList}>
        {LEVEL_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Card
              key={option.id}
              colour={option.colour}
              selected={isSelected}
              onPress={() => setSelected(option.id)}
              style={styles.levelCard}>
              <MaterialIcons name={option.icon} size={32} color={primary} />
              <Text style={[styles.levelTitle, { color: text }]}>{option.title}</Text>
              <Text style={[styles.levelSubtitle, { color: primary }]}>{option.subtitle}</Text>
              <Text style={[styles.levelBody, { color: textSecondary }]}>{option.description}</Text>
            </Card>
          );
        })}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        disabled={!selected}
        onPress={() => selected && router.push(`/setup-year?level=${selected}` as Href)}
        style={[
          styles.continueBtn,
          { backgroundColor: primary, opacity: selected ? 1 : 0.45 },
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
  cardList: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  levelCard: {
    gap: Spacing.xs,
  },
  levelTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.sm,
  },
  levelSubtitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  levelBody: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  continueBtn: {
    marginTop: Spacing.md,
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
