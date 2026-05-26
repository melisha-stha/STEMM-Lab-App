import { PixelButton } from '@/components/ui/pixel-button';
import { PixelChoiceButton } from '@/components/ui/pixel-choice-button';
import { PixelHeading } from '@/components/ui/pixel-heading';
import { PixelText } from '@/components/ui/pixel-text';
import { Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LearningLevel = 'upper_primary' | 'lower_secondary';

export default function SetupLevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<LearningLevel | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const hasSelection = selected !== null;

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
        step 1 of 3
      </PixelText>

      <View style={styles.headingBlock}>
        <PixelHeading align="left">choose your learning level</PixelHeading>
        <PixelText style={styles.subtitle}>
          we will adjust activity language and challenge style for your class.
        </PixelText>
      </View>

      <View style={styles.choiceList}>
        <PixelChoiceButton
          label="upper primary"
          description="years 4 to 6 · simple measurements and observations"
          variant="primary"
          selected={selected === 'upper_primary'}
          hasSelection={hasSelection}
          onPress={() => setSelected('upper_primary')}
          style={styles.choiceSpacing}
        />
        <PixelChoiceButton
          label="lower secondary"
          description="years 7 to 9 · forces, calculations, deeper analysis"
          variant="secondary"
          selected={selected === 'lower_secondary'}
          hasSelection={hasSelection}
          onPress={() => setSelected('lower_secondary')}
        />
      </View>

      <PixelButton
        label="continue"
        disabled={!selected}
        onPress={() => selected && router.push(`/setup-year?level=${selected}` as Href)}
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
  choiceList: {
    marginTop: Spacing.sm,
    width: '100%',
  },
  choiceSpacing: {
    marginBottom: 12,
  },
  continueBtn: {
    marginTop: Spacing.md,
  },
});
