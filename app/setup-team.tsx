import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { saveTeamData } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_MEMBERS = 5;
const INITIAL_MEMBER_FIELDS = 2;

function memberFieldLabel(index: number): string {
  if (index === 0) return 'Team member first name';
  if (index === 1) return 'Second team member (optional)';
  const ordinals = ['Third', 'Fourth', 'Fifth'];
  return `${ordinals[index - 2]} team member (optional)`;
}

export default function SetupTeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { level, year } = useLocalSearchParams<{ level?: string; year?: string }>();

  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<string[]>(
    Array.from({ length: INITIAL_MEMBER_FIELDS }, () => '')
  );
  const [errors, setErrors] = useState<{
    teamName?: string;
    member?: string;
    year?: string;
  }>({});

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary' as any) ?? '#6E6E73';  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft' as any) ?? 'rgba(0, 122, 255, 0.1)';
  const textInverse = useThemeColor({}, 'textInverse' as any) ?? '#FFFFFF';
  const error = useThemeColor({}, 'error' as any) ?? '#FF3B30';

  const yearLabel = year ? `Year ${year}` : '—';
  const learningLevel =
    level === 'lower_secondary' ? 'Lower Secondary' : 'Upper Primary';

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
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: background }]}
      behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
          <Text style={[styles.stepText, { color: primary }]}>Step 3 of 3</Text>
        </View>

        <SectionHeading
          title="Create your team"
          subtitle="Only first names are used, and your team gets a private Team ID."
        />

        <Card colour="lavender">
          <Text style={[styles.readOnlyLabel, { color: textSecondary }]}>Year Level</Text>
          <Text style={[styles.readOnlyValue, { color: text }]}>{yearLabel}</Text>
          <Text style={[styles.readOnlyHint, { color: textSecondary }]}>{learningLevel}</Text>
          {errors.year ? (
            <Text style={[styles.inlineError, { color: error }]}>{errors.year}</Text>
          ) : null}
        </Card>

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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add another team member"
            onPress={addMemberField}
            style={[styles.addMemberBtn, { backgroundColor: primarySoft, borderColor: primary }]}>
            <MaterialIcons name="person-add" size={20} color={primary} />
            <Text style={[styles.addMemberText, { color: primary }]}>Add another team member</Text>
          </TouchableOpacity>
        ) : null}

        <Card colour="sky">
          <View style={styles.privacyRow}>
            <MaterialIcons name="privacy-tip" size={22} color={primary} />
            <Text style={[styles.privacyText, { color: textSecondary }]}>
              Privacy friendly: STEMM Lab only uses first names and a team ID for results. Do not
              enter full names.
            </Text>
          </View>
        </Card>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void handleSubmit()}
          style={[styles.continueBtn, { backgroundColor: primary }]}>
          <Text style={[styles.continueText, { color: textInverse }]}>Enter STEMM Lab</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  readOnlyLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readOnlyValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xs,
  },
  readOnlyHint: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    marginTop: Spacing.xs,
  },
  inlineError: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  addMemberText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  privacyText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
    flex: 1,
  },
  continueBtn: {
    minHeight: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  continueText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});