import { Input } from '@/components/ui/input';
import { PixelBox } from '@/components/ui/pixel-box';
import { PixelButton } from '@/components/ui/pixel-button';
import { PixelHeading } from '@/components/ui/pixel-heading';
import { PixelText } from '@/components/ui/pixel-text';
import {
  TeamSetupScreenBackground,
  useTeamSetupScreenBackground,
} from '@/components/ui/team-setup-screen-background';
import { PIXEL_BRAND } from '@/constants/pixel-brand';
import { Spacing } from '@/constants/design';
import { clearSkipCloudTeamRestore, saveTeamProfile } from '@/hooks/team-profile';
import { getTeamData, saveTeamData } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_MEMBERS = 5;
const INITIAL_MEMBER_FIELDS = 2;

export const options = {
  headerShown: false,
  contentStyle: { backgroundColor: 'transparent' },
};

function memberFieldLabel(index: number): string {
  if (index === 0) return 'Team member first name';
  if (index === 1) return 'Second team member (optional)';
  const ordinals = ['Third', 'Fourth', 'Fifth'];
  return `${ordinals[index - 2]} team member (optional)`;
}

export default function SetupTeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { level, year } = useLocalSearchParams<{ level?: string; year?: string }>();
  const { overlayColor, imageOpacity } = useTeamSetupScreenBackground();

  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<string[]>(
    Array.from({ length: INITIAL_MEMBER_FIELDS }, () => '')
  );
  const [errors, setErrors] = useState<{
    teamName?: string;
    member?: string;
    year?: string;
  }>({});

  const text = useThemeColor({}, 'text');
  const surface = useThemeColor({}, 'surface');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const border = useThemeColor({}, 'border');
  const isDark = colorScheme === 'dark';
  const pixelShadow = isDark ? '#000000' : PIXEL_BRAND.purpleBorder;
  const panelBg = isDark ? surface : primarySoft;
  const panelBorder = isDark ? border : PIXEL_BRAND.purpleBorder;

  const yearLabel = year ? `Year ${year}` : '—';
  const learningLevelLabel = level === 'lower_secondary' ? 'secondary' : 'primary';

  const cleanedMembers = useMemo(
    () => members.map((m) => m.trim()).filter((m) => m.length > 0),
    [members]
  );

  const handleSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!teamName.trim()) nextErrors.teamName = 'Please enter a team name.';
    if (!members[0]?.trim()) nextErrors.member = 'Please enter at least one team member first name.';
    if (!year?.trim()) nextErrors.year = 'Year level is required. Go back and select a year.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await saveTeamData(teamName.trim(), cleanedMembers, yearLabel, {
      learningLevel: level === 'lower_secondary' ? 'lower_secondary' : 'upper_primary',
      yearLevel: year,
    });

    const saved = await getTeamData();
    await saveTeamProfile({
      name: teamName.trim(),
      members: cleanedMembers,
      grade: yearLabel,
      yearLevel: year,
      learningLevel: level === 'lower_secondary' ? 'lower_secondary' : 'upper_primary',
      id: saved?.id,
    });
    await clearSkipCloudTeamRestore();

    router.replace('/(tabs)');
  };

  const updateMember = (index: number, value: string) => {
    setMembers((prev) => prev.map((m, i) => (i === index ? value : m)));
    if (index === 0 && errors.member) {
      setErrors((e) => ({ ...e, member: undefined }));
    }
  };

  const addMemberField = () => {
    setMembers((prev) => (prev.length < MAX_MEMBERS ? [...prev, ''] : prev));
  };

  const canAddMember = members.length < MAX_MEMBERS;

  return (
    <TeamSetupScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
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
            <PixelHeading>create your team!</PixelHeading>
          </View>

          <PixelBox shadowColor={pixelShadow} style={styles.panelOuter}>
            <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
              <PixelText variant="caption">
                WARNING! Only use first names. Do Not Enter full name!
              </PixelText>
            </View>
          </PixelBox>

          <PixelBox shadowColor={pixelShadow} style={styles.panelOuter}>
            <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
              <PixelText variant="caption">year level</PixelText>
              <PixelText style={styles.yearValue}>{yearLabel.toLowerCase()}</PixelText>
              <PixelText variant="caption">{learningLevelLabel}</PixelText>
              {errors.year ? (
                <PixelText style={styles.errorText}>{errors.year}</PixelText>
              ) : null}
            </View>
          </PixelBox>

          <Input
            label="Team name"
            placeholder="e.g. Falcon Engineers"
            value={teamName}
            onChangeText={(v) => {
              setTeamName(v);
              if (errors.teamName) setErrors((e) => ({ ...e, teamName: undefined }));
            }}
            error={errors.teamName}
          />

          {members.map((member, index) => (
            <Input
              key={`member-${index}`}
              label={memberFieldLabel(index)}
              placeholder="First name"
              value={member}
              onChangeText={(v) => updateMember(index, v)}
              error={index === 0 ? errors.member : undefined}
            />
          ))}

          {canAddMember ? (
            <PixelButton
              label="add team member"
              variant="secondary"
              onPress={addMemberField}
              style={styles.addMemberBtn}
            />
          ) : null}

          <PixelButton label="enter stemm lab" onPress={() => void handleSubmit()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </TeamSetupScreenBackground>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
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
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
  },
  panelOuter: {
    width: '100%',
  },
  panel: {
    borderRadius: 8,
    borderWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  yearValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    marginTop: 4,
    color: '#FF3B30',
  },
  addMemberBtn: {
    marginTop: Spacing.xs,
  },
});
