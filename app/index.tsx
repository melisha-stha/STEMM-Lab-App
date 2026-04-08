import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { clearTeamData, getTeamData, saveTeamData } from '../hooks/storage';

export default function OnboardingScreen() {
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');

  const [teamName, setTeamName] = useState('');
  const [grade, setGrade] = useState('');
  const [members, setMembers] = useState<string[]>(['']);
  const [isCheckingExistingTeam, setIsCheckingExistingTeam] = useState(true);
  const [hasExistingTeam, setHasExistingTeam] = useState(false);

  const member1 = members[0] ?? '';

  useEffect(() => {
    const check = async () => {
      try {
        const existing = await getTeamData();
        setHasExistingTeam(Boolean(existing));
      } finally {
        setIsCheckingExistingTeam(false);
      }
    };
    check();
  }, [router]);

  const isValid = useMemo(() => {
    const hasTeam = teamName.trim().length > 0;
    const hasMember1 = member1.trim().length > 0;
    const hasGrade = grade.trim().length > 0;
    return hasTeam && hasMember1 && hasGrade;
  }, [teamName, member1, grade]);

  const cleanedMembers = useMemo(
    () => members.map((m) => m.trim()).filter((m) => m.length > 0),
    [members]
  );

  const handleCreateTeam = async () => {
    if (!isValid) {
      Alert.alert('Missing info', 'Please fill in Team Name, Member 1, and Grade / Year Level.');
      return;
    }

    await saveTeamData(teamName.trim(), cleanedMembers.length ? cleanedMembers : [member1.trim()], grade.trim());

    // Navigate to the Tabs/Home
    router.replace('/(tabs)');
  };

  const handleClearAndRestart = async () => {
    const performClear = async () => {
      await clearTeamData();
      setHasExistingTeam(false);
      setTeamName('');
      setGrade('');
      setMembers(['']);
    };

    if (Platform.OS === 'web') {
      const ok = globalThis.confirm?.(
        'Start a new team?\n\nThis will remove the current team setup from this device.'
      );
      if (ok) await performClear();
      return;
    }

    Alert.alert('Start a new team?', 'This will remove the current team setup from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void performClear() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: background }]}
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 12, default: 0 })}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: text }]}>STEMM Lab</Text>
          <Text style={[styles.heroSubtitle, { color: mutedText }]}>
            Create your team to start STEMM challenges.
          </Text>
          <Text style={[styles.heroSupport, { color: mutedText }]}>
            Your team name and members will appear on activities and results.
          </Text>
        </View>

        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Team setup</Text>

          {hasExistingTeam ? (
            <View style={[styles.notice, { borderColor: border, backgroundColor: card }]}>
              <Text style={[styles.noticeTitle, { color: text }]}>Team already set up</Text>
              <Text style={[styles.noticeBody, { color: mutedText }]}>
                This device already has a saved team. You can continue to the dashboard, or clear it to
                create a new team.
              </Text>
              <View style={styles.noticeActions}>
                <PrimaryButton label="Continue" onPress={() => router.replace('/(tabs)')} />
                <PrimaryButton label="Clear & create new" variant="danger" onPress={handleClearAndRestart} />
              </View>
            </View>
          ) : (
            <View style={[styles.form, { borderTopColor: border }]}>
              <Input
                label="Team name"
                placeholder="e.g., Falcon Engineers"
                value={teamName}
                onChangeText={setTeamName}
                returnKeyType="next"
              />

              <Input
                label="Member 1"
                placeholder="First name"
                value={members[0]}
                onChangeText={(v) => setMembers((prev) => [v, ...prev.slice(1)])}
                returnKeyType="next"
              />

              {members.slice(1).map((val, idx) => {
                const memberIndex = idx + 1;
                return (
                  <View key={memberIndex} style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={`Member ${memberIndex + 1} (optional)`}
                        placeholder="First name"
                        value={val}
                        onChangeText={(v) =>
                          setMembers((prev) => prev.map((m, i) => (i === memberIndex ? v : m)))
                        }
                        returnKeyType="next"
                      />
                    </View>
                    <PrimaryButton
                      label="Remove"
                      variant="secondary"
                      onPress={() => setMembers((prev) => prev.filter((_, i) => i !== memberIndex))}
                      style={styles.removeBtn}
                    />
                  </View>
                );
              })}

              <PrimaryButton
                label="Add another member"
                variant="secondary"
                onPress={() => setMembers((prev) => [...prev, ''])}
              />

              <Input
                label="Grade / Year level"
                placeholder="e.g., 6"
                value={grade}
                onChangeText={setGrade}
                keyboardType={Platform.select({ ios: 'number-pad', default: 'numeric' })}
                returnKeyType="done"
                onSubmitEditing={handleCreateTeam}
              />
            </View>
          )}
        </SectionCard>

        <View style={styles.actions}>
          <PrimaryButton
            label={isCheckingExistingTeam ? 'Checking…' : 'Create team'}
            onPress={handleCreateTeam}
            disabled={!isValid || isCheckingExistingTeam || hasExistingTeam}
          />
          <Text style={[styles.footer, { color: mutedText }]}>
            Classroom-friendly: info is stored locally on this device for now.
          </Text>
          <View style={[styles.accentLine, { backgroundColor: primary }]} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },

  hero: {
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  heroTitle: { ...Typography.hero },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body, fontSize: 14 },
  heroSupport: { marginTop: Spacing.xs, ...Typography.small },

  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  form: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },

  notice: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  noticeTitle: { ...Typography.section },
  noticeBody: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  noticeActions: { marginTop: Spacing.sm, gap: Spacing.sm },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  removeBtn: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
  },

  actions: { gap: Spacing.sm },
  footer: { ...Typography.small, textAlign: 'center' },
  accentLine: {
    alignSelf: 'center',
    height: 3,
    width: 56,
    borderRadius: Radius.pill,
    opacity: 0.9,
  },
});