import { InfoRow } from '@/components/ui/info-row';
import { Input } from '@/components/ui/input';
import { PixelBatteryIcon } from '@/components/ui/pixel-battery-icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { LabJournalSection } from '@/components/ui/lab-journal-section';
import { SectionCard } from '@/components/ui/section-card';
import { SCREEN_BOTTOM_INSET, Spacing, Typography } from '@/constants/design';
import { usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import { clearMissionWelcomePending } from '@/hooks/notifications';
import { useDeviceBattery } from '@/hooks/useDeviceBattery';
import { clearTeamData, getTeamData, saveTeamData } from '@/hooks/storage';
import {
  clearSkipCloudTeamRestore,
  resetTeamSetup,
  saveTeamProfile,
} from '@/hooks/team-profile';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TeamScreenBackground, useTeamScreenBackground } from '@/components/ui/team-screen-background';
import { auth } from '@/hooks/firebaseConfig';
import { filterTrialsByTeam, getTrials } from '@/hooks/database';
import { loadLabJournalEntries, type LabJournalEntry } from '@/utils/formatters/lab-journal';

type AvatarKey = 'ben' | 'girl' | 'frog' | 'bunny' | 'cat' | 'fox';

const AVATARS: { key: AvatarKey; label: string; source: any }[] = [
  { key: 'ben', label: 'Ben', source: require('@/assets/images/boy-avatar.png') },
  { key: 'girl', label: 'Girl', source: require('@/assets/images/girl-avatar.png') },
  { key: 'frog', label: 'Frog', source: require('@/assets/images/frog-avatar.png') },
  { key: 'bunny', label: 'Bunny', source: require('@/assets/images/bunny-avatar.png') },
  { key: 'cat', label: 'Cat', source: require('@/assets/images/cat-avatar.png') },
  { key: 'fox', label: 'Fox', source: require('@/assets/images/fox-avatar.png') },
];

export default function TeamTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const [team, setTeam] = useState<{
    name: string;
    id: number;
    members: string[];
    grade: string;
    yearLevel?: string;
    learningLevel?: string;
    avatarKey?: AvatarKey;
  } | null>(null);
  const [trials, setTrials] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<LabJournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAvatarKey, setPendingAvatarKey] = useState<AvatarKey>('frog');
  const [form, setForm] = useState<{
    teamName: string;
    yearLevel: string;
    learningLevel: 'lower_secondary' | 'upper_primary' | '';
    members: string[];
    avatarKey: AvatarKey;
  }>({
    teamName: '',
    yearLevel: '',
    learningLevel: '',
    members: [''],
    avatarKey: 'frog',
  });
  const [errors, setErrors] = useState<{
    teamName?: string;
    yearLevel?: string;
    members?: string;
  }>({});

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const primary = useThemeColor({}, 'primary');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');

  const cardLavender = useThemeColor({}, 'cardLavender');
  const cardLavenderBorder = useThemeColor({}, 'cardLavenderBorder');
  const cardLavenderShadow = useThemeColor({}, 'cardLavenderShadow');
  const cardLavenderText = useThemeColor({}, 'cardLavenderText');
  const cardSky = useThemeColor({}, 'cardSky');
  const cardSkyBorder = useThemeColor({}, 'cardSkyBorder');
  const cardSkyShadow = useThemeColor({}, 'cardSkyShadow');
  const cardSkyText = useThemeColor({}, 'cardSkyText');
  const cardMint = useThemeColor({}, 'cardMint');
  const cardMintBorder = useThemeColor({}, 'cardMintBorder');
  const cardMintShadow = useThemeColor({}, 'cardMintShadow');
  const cardMintText = useThemeColor({}, 'cardMintText');
  const cardYellow = useThemeColor({}, 'cardYellow');
  const cardYellowBorder = useThemeColor({}, 'cardYellowBorder');
  const cardYellowShadow = useThemeColor({}, 'cardYellowShadow');
  const cardYellowText = useThemeColor({}, 'cardYellowText');

  const { overlayColor, imageOpacity } = useTeamScreenBackground();
  const deviceBattery = useDeviceBattery();

  const batteryFillColor = (() => {
    if (deviceBattery.isCharging) return primary;
    const level = deviceBattery.levelPercent;
    if (level == null) return mutedText;
    if (level >= 50) return cardMintText;
    if (level >= 20) return cardYellowText;
    return danger;
  })();

  const batteryPercentLabel =
    deviceBattery.levelPercent != null ? `${deviceBattery.levelPercent}%` : '—';

  useEffect(() => {
    const load = async () => {
      const data = await getTeamData();
      setTeam(data);

      const avatarKey = (data?.avatarKey as AvatarKey) || 'frog';
      setPendingAvatarKey(avatarKey);
      setForm({
        teamName: data?.name ?? '',
        yearLevel: (data?.yearLevel ?? '').toString().replace(/^Year\s*/i, ''),
        learningLevel: (data?.learningLevel as any) ?? '',
        members: Array.isArray(data?.members) && data.members.length ? data.members : [''],
        avatarKey,
      });
    };
    void load();
  }, []);

  const refreshTrials = useCallback(() => {
    try {
      const rows = getTrials();
      setTrials(Array.isArray(rows) ? rows : []);
    } catch {
      setTrials([]);
    }
  }, []);

  const refreshLabJournal = useCallback(async () => {
    if (!team?.name?.trim() && team?.id == null) {
      setJournalEntries([]);
      setJournalLoading(false);
      return;
    }

    setJournalLoading(true);
    try {
      const entries = await loadLabJournalEntries(team.name, team.id ?? null);
      setJournalEntries(entries);
    } catch {
      setJournalEntries([]);
    } finally {
      setJournalLoading(false);
    }
  }, [team]);

  useFocusEffect(
    useCallback(() => {
      refreshTrials();
      if (team) {
        void refreshLabJournal();
      } else {
        setJournalEntries([]);
        setJournalLoading(false);
      }
    }, [refreshTrials, refreshLabJournal, team])
  );

  useEffect(() => {
    if (team) {
      void refreshLabJournal();
    }
  }, [team, refreshLabJournal]);

  const handleResetTeam = () => {
    const performReset = async () => {
      setIsSaving(true);
      try {
        const next = await resetTeamSetup();
        router.replace((next === 'setup' ? '/setup-level' : '/welcome-screen') as Href);
      } catch {
        Alert.alert('Reset failed', 'Please try again.');
      } finally {
        setIsSaving(false);
      }
    };

    const resetMessage =
      auth?.currentUser
        ? 'Your team name and members will be cleared and you will set up again. Your account stays signed in. Lab trials on this device are kept.'
        : 'Your local team setup will be cleared on this device.';

    if (Platform.OS === 'web') {
      const ok = globalThis.confirm?.(resetMessage);
      if (ok) void performReset();
      return;
    }

    Alert.alert('Reset team setup?', resetMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void performReset() },
    ]);
  };

  const handleSignOut = () => {
    const performSignOut = async () => {
      setIsSaving(true);
      try {
        // Clear local cache; allow cloud restore on next login.
        await clearTeamData();
        await clearSkipCloudTeamRestore();
        await clearMissionWelcomePending();
        await auth.signOut();
        router.replace('/welcome-screen' as Href);
      } catch {
        Alert.alert('Sign out failed', 'Please try again.');
      } finally {
        setIsSaving(false);
      }
    };

    if (!auth?.currentUser) {
      Alert.alert('Not signed in', 'You are currently using local-only mode.');
      return;
    }

    if (Platform.OS === 'web') {
      const ok = globalThis.confirm?.(
        'Sign out? Your team profile stays saved in the cloud — sign in again to restore it.'
      );
      if (ok) void performSignOut();
      return;
    }

    Alert.alert(
      'Sign out?',
      'You will return to the welcome screen. Your team profile stays saved in the cloud — sign in again with the same account to restore it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void performSignOut() },
      ]
    );
  };

  const yearDisplay = (() => {
    const raw = (team?.yearLevel ?? team?.grade ?? '').toString().trim();
    if (!raw) return '—';
    return /^year\s+/i.test(raw) ? raw : `Year ${raw}`;
  })();
  const levelDisplay =
    team?.learningLevel === 'lower_secondary'
      ? 'Secondary'
      : team?.learningLevel === 'upper_primary'
        ? 'Primary'
        : '—';

  const avatarKey: AvatarKey = (team?.avatarKey as AvatarKey) || 'frog';
  const activeAvatar = AVATARS.find((a) => a.key === avatarKey) ?? AVATARS.find((a) => a.key === 'frog')!;

  const teamName = team?.name?.trim() || 'Team';
  const teamTrials = filterTrialsByTeam(trials, teamName);
  const activitiesCompleted = new Set(teamTrials.map((t) => t?.activity).filter(Boolean)).size;
  const savedAttempts = teamTrials.length;
  const latestActivityKey = teamTrials.length ? teamTrials[teamTrials.length - 1]?.activity : null;
  const latestActivityLabel =
    latestActivityKey === 'parachute'
      ? 'Parachute Drop'
      : latestActivityKey === 'sound'
        ? 'Sound Pollution Hunter'
        : latestActivityKey === 'earthquake'
          ? 'Earthquake Structure'
          : latestActivityKey === 'reaction'
            ? 'Reaction Board'
            : latestActivityKey === 'breathing'
              ? 'Breathing Pace Trainer'
              : latestActivityKey === 'handfan'
                ? 'Hand Fan Challenge'
                : latestActivityKey === 'performance'
                  ? 'Human Performance Lab'
                  : 'Not started';

  const syncStatus = auth?.currentUser ? 'Signed in (cloud sync ready)' : 'Local only';

  const selectAvatar = (next: AvatarKey) => {
    setPendingAvatarKey(next);
    setForm((f) => ({ ...f, avatarKey: next }));
  };

  const saveAvatar = async () => {
    if (!team) return;
    setIsSaving(true);
    try {
      await saveTeamData(team.name, team.members, team.grade, {
        yearLevel: team.yearLevel ?? team.grade,
        learningLevel: team.learningLevel ?? null,
        avatarKey: pendingAvatarKey,
      });
      const refreshed = await getTeamData();
      if (refreshed) {
        await saveTeamProfile({
          name: refreshed.name,
          members: refreshed.members,
          grade: refreshed.grade,
          yearLevel: refreshed.yearLevel ?? null,
          learningLevel: refreshed.learningLevel ?? null,
          avatarKey: refreshed.avatarKey ?? null,
          id: refreshed.id,
        });
      }
      setTeam(refreshed);
      setAvatarPickerOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setErrors({});
    setEditOpen(true);
  };

  const closeEdit = () => {
    setErrors({});
    setEditOpen(false);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.teamName.trim()) next.teamName = 'Team name is required.';
    if (!form.yearLevel.trim()) next.yearLevel = 'Year level is required.';
    const cleanedMembers = form.members.map((m) => m.trim()).filter(Boolean);
    if (cleanedMembers.length === 0) next.members = 'At least one first name is required.';
    setErrors(next);
    return { ok: Object.keys(next).length === 0, cleanedMembers };
  };

  const handleSaveEdits = async () => {
    const { ok, cleanedMembers } = validate();
    if (!ok || !team) return;

    setIsSaving(true);
    try {
      const yearLabel = form.yearLevel.trim().toLowerCase().startsWith('year ')
        ? form.yearLevel.trim()
        : `Year ${form.yearLevel.trim()}`;

      await saveTeamData(form.teamName.trim(), cleanedMembers, team.grade || yearLabel, {
        yearLevel: yearLabel,
        learningLevel: form.learningLevel || team.learningLevel || null,
        avatarKey: form.avatarKey,
      });

      const refreshed = await getTeamData();
      if (refreshed) {
        await saveTeamProfile({
          name: refreshed.name,
          members: refreshed.members,
          grade: refreshed.grade,
          yearLevel: refreshed.yearLevel ?? null,
          learningLevel: refreshed.learningLevel ?? null,
          avatarKey: refreshed.avatarKey ?? null,
          id: refreshed.id,
        });
      }
      setTeam(refreshed);
      setEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <TeamScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(Spacing.sm, insets.top + Spacing.sm), paddingBottom: SCREEN_BOTTOM_INSET },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {pixelFontLoaded ? (
              <Text style={withPixelFontStyle(pixelFamily, styles.title, { color: text })}>
                Team Lab Profile
              </Text>
            ) : (
              <Text style={[styles.title, { color: text }]}>Team Lab Profile</Text>
            )}
            <Text style={[styles.subtitle, { color: mutedText }]}>
              Manage your team identity, progress, and privacy-safe lab details.
            </Text>
          </View>

          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: cardLavender,
                borderColor: cardLavenderBorder,
                borderBottomColor: cardLavenderShadow,
              },
            ]}>
            <View style={styles.profileRow}>
              <View style={styles.avatarColumn}>
                <View style={[styles.avatarFrame, { borderColor: cardLavenderText }]}>
                  <Image source={activeAvatar.source} style={styles.avatarImage} contentFit="cover" />
                </View>
                <PrimaryButton
                  label={avatarPickerOpen ? 'Hide avatars' : 'Edit avatar'}
                  variant="secondary"
                  onPress={() => {
                    setPendingAvatarKey(avatarKey);
                    setAvatarPickerOpen((v) => !v);
                  }}
                  style={styles.editAvatarBtn}
                />
              </View>
              <View style={styles.profileMeta}>
                {pixelFontLoaded ? (
                  <Text style={withPixelFontStyle(pixelFamily, styles.teamName, { color: cardLavenderText })}>
                    {team?.name || '—'}
                  </Text>
                ) : (
                  <Text style={[styles.teamName, { color: cardLavenderText }]}>{team?.name || '—'}</Text>
                )}
                <Text style={[styles.metaLine, { color: cardLavenderText, opacity: 0.9 }]}>{yearDisplay}</Text>
                <Text style={[styles.metaLine, { color: cardLavenderText, opacity: 0.9 }]}>{levelDisplay}</Text>

                <View style={[styles.idBadge, { backgroundColor: primarySoft, borderColor: primary }]}>
                  <MaterialIcons name="verified" size={16} color={primary} />
                  <Text style={[styles.idBadgeText, { color: primary }]}>Team ID: {team?.id ? String(team.id) : '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          {avatarPickerOpen ? (
            <SectionCard style={styles.sectionCardTight}>
              <View style={styles.sectionTitleRow}>
                {pixelFontLoaded ? (
                  <Text style={withPixelFontStyle(pixelFamily, styles.sectionTitle, { color: text })}>
                    Choose Team Avatar
                  </Text>
                ) : (
                  <Text style={[styles.sectionTitle, { color: text }]}>Choose Team Avatar</Text>
                )}
              </View>

              <View style={styles.avatarGrid} accessibilityRole="radiogroup">
                {AVATARS.map((a) => {
                  const selected = a.key === pendingAvatarKey;
                  return (
                    <View key={a.key} style={styles.avatarCell}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Select avatar: ${a.label}`}
                        onPress={() => selectAvatar(a.key)}
                        style={[
                          styles.avatarChoiceOuter,
                          {
                            borderColor: selected ? primary : border,
                            borderBottomColor: selected ? primaryDark : border,
                            backgroundColor: selected ? primarySoft : 'transparent',
                          },
                        ]}>
                        <View style={[styles.avatarChoiceFrame, { borderColor: selected ? primary : border }]}>
                          <Image source={a.source} style={styles.avatarChoiceImage} contentFit="cover" />
                        </View>
                        {selected ? (
                          <View style={[styles.avatarSelectedBadge, { backgroundColor: primary }]}>
                            <MaterialIcons name="check" size={14} color={onPrimary} />
                          </View>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                <PrimaryButton
                  label={isSaving ? 'Saving…' : 'Save avatar'}
                  onPress={() => void saveAvatar()}
                  disabled={isSaving || !team || pendingAvatarKey === avatarKey}
                />
                <PrimaryButton
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setPendingAvatarKey(avatarKey);
                    setAvatarPickerOpen(false);
                  }}
                  disabled={isSaving}
                />
              </View>
            </SectionCard>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            {pixelFontLoaded ? (
              <Text style={withPixelFontStyle(pixelFamily, styles.sectionTitle, { color: text })}>
                Team details
              </Text>
            ) : (
              <Text style={[styles.sectionTitle, { color: text }]}>Team details</Text>
            )}
          </View>

          <SectionCard>
            <InfoRow label="Team name" value={team?.name || '—'} />
            <InfoRow label="Team ID" value={team?.id ? String(team.id) : '—'} />
            <InfoRow label="Year level" value={yearDisplay} />
            <InfoRow label="Learning level" value={levelDisplay} />
            <InfoRow label="Members" value={team?.members?.length ? team.members.join(', ') : '—'} />
          </SectionCard>

          <PrimaryButton label={editOpen ? 'Close editor' : 'Edit team details'} variant="secondary" onPress={editOpen ? closeEdit : openEdit} />

          <View style={styles.sectionHeaderRow}>
            {pixelFontLoaded ? (
              <Text style={withPixelFontStyle(pixelFamily, styles.sectionTitle, { color: text })}>
                Device battery
              </Text>
            ) : (
              <Text style={[styles.sectionTitle, { color: text }]}>Device battery</Text>
            )}
            <Text style={[styles.batterySectionHint, { color: mutedText }]}>
              Live status from this phone — updates while you stay on this screen.
            </Text>
          </View>

          <View
            style={[
              styles.batteryCard,
              {
                backgroundColor: cardMint,
                borderColor: cardMintBorder,
                borderBottomColor: cardMintShadow,
              },
            ]}>
            <View style={styles.batteryRow}>
              <PixelBatteryIcon
                percent={deviceBattery.levelPercent}
                charging={deviceBattery.isCharging}
                fillColor={batteryFillColor}
                trackColor="rgba(0,0,0,0.08)"
                borderColor={cardMintText}
                chargingAccentColor={onPrimary}
              />
              <View style={styles.batteryMeta}>
                {pixelFontLoaded ? (
                  <Text
                    style={withPixelFontStyle(pixelFamily, styles.batteryPercent, {
                      color: cardMintText,
                    })}>
                    {batteryPercentLabel}
                  </Text>
                ) : (
                  <Text style={[styles.batteryPercent, { color: cardMintText }]}>
                    {batteryPercentLabel}
                  </Text>
                )}
                <View style={styles.batteryStatusRow}>
                  <MaterialIcons
                    name={deviceBattery.isCharging ? 'bolt' : 'battery-std'}
                    size={18}
                    color={cardMintText}
                  />
                  <Text style={[styles.batteryStatusText, { color: cardMintText }]}>
                    {deviceBattery.stateLabel}
                  </Text>
                </View>
                <Text style={[styles.batteryHealthText, { color: cardMintText, opacity: 0.9 }]}>
                  {deviceBattery.healthLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.batteryInfoBlock, { borderTopColor: cardMintBorder }]}>
              <InfoRow
                label="Power source"
                value={deviceBattery.isCharging ? 'External power' : 'Battery'}
              />
              <InfoRow label="Charge state" value={deviceBattery.stateLabel} />
              <InfoRow
                label="Low power mode"
                value={deviceBattery.lowPowerMode ? 'On' : 'Off'}
              />
              <InfoRow
                label="Sensor API"
                value={
                  deviceBattery.available
                    ? 'Available on this device'
                    : 'Limited (simulator or unsupported browser)'
                }
              />
            </View>
          </View>

          {editOpen ? (
            <SectionCard>
              <Text style={[styles.editIntro, { color: mutedText }]}>
                First names only. Please avoid private information.
              </Text>

              <Input
                label="Team name"
                value={form.teamName}
                onChangeText={(v) => setForm((f) => ({ ...f, teamName: v }))}
                error={errors.teamName}
                placeholder="e.g. Falcon Engineers"
              />

              <Input
                label="Year level"
                value={form.yearLevel}
                onChangeText={(v) => setForm((f) => ({ ...f, yearLevel: v }))}
                error={errors.yearLevel}
                placeholder="e.g. 7"
                keyboardType="number-pad"
              />

              <View style={{ marginTop: Spacing.sm }}>
                <Text style={[styles.editLabel, { color: text }]}>Learning level</Text>
                <View style={styles.pillRow}>
                  {[
                    { key: 'upper_primary', label: 'Primary' },
                    { key: 'lower_secondary', label: 'Secondary' },
                  ].map((opt) => {
                    const selected = form.learningLevel === (opt.key as any);
                    return (
                      <PrimaryButton
                        key={opt.key}
                        label={opt.label}
                        variant={selected ? 'primary' : 'secondary'}
                        onPress={() => setForm((f) => ({ ...f, learningLevel: opt.key as any }))}
                        style={styles.pillBtn}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={{ marginTop: Spacing.sm }}>
                <Text style={[styles.editLabel, { color: text }]}>Members (first names)</Text>
                {errors.members ? (
                  <Text style={[styles.inlineError, { color: danger }]}>{errors.members}</Text>
                ) : null}
                <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                  {form.members.map((m, idx) => (
                    <Input
                      key={`m-${idx}`}
                      label={idx === 0 ? 'Team member 1' : `Team member ${idx + 1} (optional)`}
                      value={m}
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          members: f.members.map((x, i) => (i === idx ? v : x)),
                        }))
                      }
                      placeholder="First name"
                    />
                  ))}
                  {form.members.length < 5 ? (
                    <PrimaryButton
                      label="Add another member"
                      variant="secondary"
                      onPress={() => setForm((f) => ({ ...f, members: [...f.members, ''] }))}
                    />
                  ) : null}
                </View>
              </View>

              <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                <PrimaryButton label={isSaving ? 'Saving…' : 'Save changes'} onPress={() => void handleSaveEdits()} disabled={isSaving} />
                <PrimaryButton label="Cancel" variant="secondary" onPress={closeEdit} disabled={isSaving} />
              </View>
            </SectionCard>
          ) : null}

          <View
            style={[
              styles.profileCard,
              { backgroundColor: cardSky, borderColor: cardSkyBorder, borderBottomColor: cardSkyShadow },
            ]}>
            {pixelFontLoaded ? (
              <Text style={withPixelFontStyle(pixelFamily, styles.cardTitle, { color: cardSkyText })}>
                Privacy friendly
              </Text>
            ) : (
              <Text style={[styles.cardTitle, { color: cardSkyText }]}>Privacy friendly</Text>
            )}
            <Text style={[styles.cardBody, { color: cardSkyText, opacity: 0.9 }]}>
              STEMM Lab only uses first names, a team name, and a generated Team ID. Do not enter full
              names, school names, emails, or private student information.
            </Text>
          </View>

          <View style={styles.sectionHeaderRow}>
            {pixelFontLoaded ? (
              <Text style={withPixelFontStyle(pixelFamily, styles.sectionTitle, { color: text })}>
                Progress
              </Text>
            ) : (
              <Text style={[styles.sectionTitle, { color: text }]}>Progress</Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: cardMint, borderColor: cardMintBorder, borderBottomColor: cardMintShadow },
              ]}>
              <Text style={[styles.statValue, { color: cardMintText }]}>{activitiesCompleted}</Text>
              <Text style={[styles.statLabel, { color: cardMintText }]}>Activities completed</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: cardYellow, borderColor: cardYellowBorder, borderBottomColor: cardYellowShadow },
              ]}>
              <Text style={[styles.statValue, { color: cardYellowText }]}>{savedAttempts}</Text>
              <Text style={[styles.statLabel, { color: cardYellowText }]}>Saved attempts</Text>
            </View>
          </View>

          <SectionCard>
            <InfoRow label="Latest activity" value={latestActivityLabel || 'Not started'} />
            <InfoRow label="Sync status" value={syncStatus} />
          </SectionCard>

          {team ? (
            <LabJournalSection
              entries={journalEntries}
              loading={journalLoading}
              pixelFontLoaded={pixelFontLoaded}
              pixelFamily={pixelFamily}
              textColor={text}
              mutedTextColor={mutedText}
              borderColor={border}
              cardBackground={cardLavender}
              cardBorder={cardLavenderBorder}
              cardShadow={cardLavenderShadow}
              accentColor={cardLavenderText}
            />
          ) : null}

          <View style={styles.sectionHeaderRow}>
            {pixelFontLoaded ? (
              <Text style={withPixelFontStyle(pixelFamily, styles.sectionTitle, { color: text })}>
                Danger Zone
              </Text>
            ) : (
              <Text style={[styles.sectionTitle, { color: text }]}>Danger Zone</Text>
            )}
            <Text style={[styles.dangerHint, { color: mutedText }]}>
              Sign out keeps your cloud team for next login. Reset clears team setup and sends you
              through onboarding again (lab trials on this device are kept).
            </Text>
          </View>

          <PrimaryButton
            label={isSaving ? 'Signing out…' : 'Sign out'}
            variant="secondary"
            onPress={handleSignOut}
            disabled={isSaving}
          />
          <PrimaryButton
            label={isSaving ? 'Resetting…' : 'Reset team setup'}
            variant="danger"
            onPress={handleResetTeam}
            disabled={isSaving}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  page: { flex: 1, backgroundColor: 'transparent' },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: { gap: Spacing.xs, paddingHorizontal: Spacing.xs },
  title: { ...Typography.hero, fontSize: 28, fontWeight: '900', letterSpacing: 1.2 },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  profileCard: {
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  profileRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatarColumn: { alignItems: 'center', gap: Spacing.xs },
  avatarFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  avatarImage: { width: '100%', height: '100%' },
  editAvatarBtn: { minHeight: 38, paddingHorizontal: 10, borderRadius: 999 },
  profileMeta: { flex: 1, gap: 4 },
  teamName: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  metaLine: { ...Typography.small, fontSize: 13, fontWeight: '700' },
  idBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  idBadgeText: { ...Typography.small, fontSize: 12, fontWeight: '800' },
  sectionHeaderRow: { gap: 6, paddingHorizontal: Spacing.xs, marginTop: Spacing.sm },
  sectionTitleRow: { marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.section, fontSize: 18, fontWeight: '900', letterSpacing: 0.6 },
  sectionCardTight: { padding: Spacing.md },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  avatarCell: { width: '31.5%' },
  avatarChoiceOuter: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 18,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChoiceFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  avatarChoiceImage: { width: '100%', height: '100%' },
  avatarSelectedBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  srOnly: { height: 0, width: 0, opacity: 0 },
  editIntro: { ...Typography.small, marginBottom: Spacing.sm },
  editLabel: { ...Typography.small, fontSize: 13, fontWeight: '800' },
  inlineError: { ...Typography.small, marginTop: Spacing.xs },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, flexWrap: 'wrap' },
  pillBtn: { flexGrow: 1 },
  cardTitle: { ...Typography.section, fontSize: 18, fontWeight: '900', letterSpacing: 0.8 },
  cardBody: { ...Typography.body, marginTop: Spacing.sm, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    padding: Spacing.md,
  },
  statValue: { fontSize: 34, fontWeight: '900', fontFamily: 'monospace' },
  statLabel: { ...Typography.small, marginTop: 4, fontWeight: '800' },
  dangerHint: { ...Typography.small, lineHeight: 18 },
  batterySectionHint: { ...Typography.small, lineHeight: 18 },
  batteryCard: {
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  batteryMeta: {
    flex: 1,
    gap: 6,
  },
  batteryPercent: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  batteryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryStatusText: {
    ...Typography.small,
    fontSize: 14,
    fontWeight: '800',
  },
  batteryHealthText: {
    ...Typography.small,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  batteryInfoBlock: {
    borderTopWidth: 1,
    marginTop: Spacing.xs,
  },
});
