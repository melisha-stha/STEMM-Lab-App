import {
  SetupScreenBackground,
  setupScreenSafeBackground,
  useSetupScreenBackground,
} from '@/components/ui/setup-screen-background';
import { PixelButton } from '@/components/ui/pixel-button';
import { PixelChoiceButton } from '@/components/ui/pixel-choice-button';
import { PixelHeading } from '@/components/ui/pixel-heading';
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
  const { overlayColor, imageOpacity } = useSetupScreenBackground();

  const text = useThemeColor({}, 'text');
  const hasSelection = selected !== null;

  return (
    <View style={styles.root}>
      <SetupScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <ScrollView
        style={styles.page}
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

        <View style={styles.titleWrap}>
          <PixelHeading>pick your level!</PixelHeading>
        </View>

        <View style={styles.choiceList}>
          <PixelChoiceButton
            label="primary"
            description="years 4 to 6"
            variant="primary"
            selected={selected === 'upper_primary'}
            hasSelection={hasSelection}
            onPress={() => setSelected('upper_primary')}
            style={styles.choiceSpacing}
          />
          <PixelChoiceButton
            label="secondary"
            description="years 7 to 9"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: setupScreenSafeBackground,
  },
  page: {
    flex: 1,
  },
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
  titleWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
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
