import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadSoundResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

function getDbRisk(db: number): { label: string; color: string } {
  if (db < 30) return { label: 'No Risk', color: '#2E7D32' };
  if (db < 60) return { label: 'Safe', color: '#558B2F' };
  if (db < 85) return { label: 'Long Exposure Risk', color: '#F9A825' };
  if (db < 90) return { label: 'Hearing Damage Possible', color: '#EF6C00' };
  if (db < 100) return { label: 'Hearing Damage Likely', color: '#E53935' };
  if (db < 110) return { label: 'Serious Damage', color: '#B71C1C' };
  if (db < 120) return { label: 'Painful', color: '#880E4F' };
  if (db < 130) return { label: 'Severe Damage', color: '#4A148C' };
  return { label: 'Instant Permanent Damage', color: '#000000' };
}

const SOUND_LEVEL_TABLE_ROWS = [
  { level: '0–30 dB', examples: 'Whisper, quiet library', risk: 'No risk', color: '#2E7D32' },
  { level: '30–60 dB', examples: 'Normal conversation, classroom noise', risk: 'Safe for long periods', color: '#558B2F' },
  {
    level: '60–85 dB',
    examples: 'Busy traffic, vacuum cleaner',
    risk: 'Generally safe, but long exposure can cause fatigue',
    color: '#F9A825',
  },
  {
    level: '85–90 dB',
    examples: 'Lawn mower, loud classroom, heavy traffic',
    risk: 'Hearing damage possible after long exposure',
    color: '#EF6C00',
  },
  {
    level: '90–100 dB',
    examples: 'Motorbike, power tools, loud music',
    risk: 'Hearing damage likely after short exposure',
    color: '#E53935',
  },
  {
    level: '100–110 dB',
    examples: 'Nightclub, rock concert, chainsaw',
    risk: 'Serious hearing damage in minutes',
    color: '#B71C1C',
  },
  {
    level: '110–120 dB',
    examples: 'Siren close by, car horn at 1 m',
    risk: 'Painful; immediate damage possible',
    color: '#880E4F',
  },
  {
    level: '120–130 dB',
    examples: 'Jet engine at close range',
    risk: 'Immediate and severe hearing damage',
    color: '#4A148C',
  },
  {
    level: '140+ dB',
    examples: 'Explosion, gunshot',
    risk: 'Instant, permanent hearing damage',
    color: '#000000',
  },
] as const;

// Convert expo-av metering (-160 to 0) to approximate dB (0–120)
function meterToDb(meter: number): number {
  const clamped = Math.max(-160, Math.min(0, meter));
  return Math.round(((clamped + 160) / 160) * 120);
}

export default function SoundScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveDb, setLiveDb] = useState(0);
  const [actionLabel, setActionLabel] = useState('');
  const [measurements, setMeasurements] = useState<{ db: number; label: string }[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const peakDbRef = useRef(0);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopRecording(); };
  }, []);

  const startRecording = async () => {
    if (measurements.length >= 3) return;
    if (!actionLabel.trim()) {
      Alert.alert('Add a label', 'Describe the action first (e.g. "dropping a book").');
      return;
    }

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Microphone access is required.');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    peakDbRef.current = 0;

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
      (status) => {
        if (status.isRecording && status.metering !== undefined) {
          const db = meterToDb(status.metering);
          setLiveDb(db);
          if (db > peakDbRef.current) peakDbRef.current = db;
        }
      },
      100 // update every 100ms
    );

    recordingRef.current = recording;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
    } catch (_) {}
    recordingRef.current = null;
    setIsRecording(false);

    const peakDb = peakDbRef.current;
    if (peakDb > 0 && measurements.length < 3) {
      setMeasurements(prev => [...prev, { db: peakDb, label: actionLabel.trim() }]);
      setActionLabel('');
      setLiveDb(0);
    }
  };

  const resetAll = () => {
    stopRecording();
    setMeasurements([]);
    setActionLabel('');
    setLiveDb(0);
  };

  const finishAndSave = async () => {
    if (!measurements.length) return;
    const user = auth.currentUser;
    if (!user) return;

    setIsSyncing(true);
    try {
      let locationData = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      const teamData = await getTeamData();
      const peakDb = Math.max(...measurements.map(m => m.db));

      // Parallel Programming: Firestore and SQLite run concurrently
      await Promise.all([
        uploadSoundResult(user.uid, teamData, measurements, locationData),
        Promise.resolve(insertTrial(
          teamData?.name || 'unknown',
          'sound',
          peakDb,
          '',
          locationData?.latitude || null,
          locationData?.longitude || null
        ))
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Sound data for ${teamData?.name || 'your team'} has been saved!`,
          data: { screen: 'sound' },
        },
        trigger: null,
      });

      Alert.alert('Saved!', 'Your sound measurements have been saved.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);

    } catch (error) {
      console.error('Sound Save Error:', error);
      Alert.alert('Save Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const risk = getDbRisk(liveDb);
  const loudest = measurements.length ? Math.max(...measurements.map(m => m.db)) : null;

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Sound Pollution Hunter</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Measure and compare sound levels in your classroom.</Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Instructions</Text>
        <View style={[styles.bullets, { borderTopColor: border }]}>
          <Text style={[styles.bullet, { color: mutedText }]}>• Label the action before recording (e.g. "dropping a book").</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Tap Start and perform the action near the phone.</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Tap Stop to record the peak dB level.</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Record up to 3 different actions and compare results.</Text>
        </View>
      </SectionCard>

      {/* Live Meter Panel */}
      <View style={[styles.meterPanel, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.timerLabel, { color: mutedText }]}>Live Sound Level</Text>
        <Text style={[styles.dbValue, { color: risk.color }]}>{liveDb} dB</Text>
        <View style={[styles.riskBadge, { backgroundColor: risk.color + '22', borderColor: risk.color }]}>
          <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
        </View>

        {/* Action label input */}
        <Text style={[styles.inputLabel, { color: mutedText }]}>Action Label</Text>
        <TextInput
          style={[styles.input, { borderColor: border, color: text, backgroundColor: background }]}
          placeholder='e.g. dropping a book'
          placeholderTextColor={mutedText}
          value={actionLabel}
          onChangeText={setActionLabel}
          editable={!isRecording && measurements.length < 3}
        />

        <View style={styles.buttons}>
          <PrimaryButton
            label={isRecording ? 'Stop & Record' : 'Start Recording'}
            variant={isRecording ? 'danger' : 'primary'}
            disabled={measurements.length >= 3 || isSyncing}
            onPress={() => isRecording ? stopRecording() : startRecording()}
          />
          <PrimaryButton
            label='Reset'
            variant='secondary'
            onPress={resetAll}
            disabled={isSyncing || (measurements.length === 0 && !isRecording)}
          />
          <PrimaryButton
            label={isSyncing ? 'Saving...' : 'Finish & Save'}
            variant='secondary'
            onPress={finishAndSave}
            disabled={measurements.length === 0 || isRecording || isSyncing}
            style={{ borderColor: primary }}
          />
        </View>

        <View style={styles.helperRow}>
          <Text style={[styles.helper, { color: mutedText }]}>Measurements: {measurements.length}/3</Text>
          {loudest !== null && (
            <Text style={[styles.helper, { color: primary }]}>Loudest: {loudest} dB</Text>
          )}
        </View>
      </View>

      {/* Results */}
      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Measurements</Text>
        {measurements.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>No measurements recorded yet.</Text>
        ) : (
          <View style={[styles.measureList, { borderTopColor: border }]}>
            {measurements.map((m, i) => {
              const r = getDbRisk(m.db);
              const isLoudest = m.db === loudest;
              return (
                <View key={i} style={[styles.measureRow, { borderColor: isLoudest ? r.color : border, backgroundColor: card }]}>
                  <View>
                    <Text style={[styles.measureAction, { color: mutedText }]}>Action {i + 1}: {m.label}</Text>
                    <Text style={[styles.measureDb, { color: r.color }]}>{m.db} dB</Text>
                  </View>
                  <View style={[styles.riskBadge, { backgroundColor: r.color + '22', borderColor: r.color }]}>
                    <Text style={[styles.riskLabel, { color: r.color }]}>
                      {isLoudest ? '🔊 Loudest' : r.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Hearing Damage Risk Guide</Text>
        <View style={[styles.table, { borderColor: border }]}>
          <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
            <Text style={[styles.tableHeaderCell, styles.tableColLevel, { color: text }]}>Sound Level</Text>
            <Text style={[styles.tableHeaderCell, styles.tableColExamples, { color: text }]}>
              Example Sounds
            </Text>
            <Text style={[styles.tableHeaderCell, styles.tableColRisk, { color: text }]}>
              Risk to Hearing
            </Text>
          </View>
          {SOUND_LEVEL_TABLE_ROWS.map((row, i) => (
            <View
              key={row.level}
              style={[
                styles.tableRow,
                {
                  backgroundColor: i % 2 === 0 ? background : card,
                  borderBottomColor: border,
                  borderBottomWidth: i < SOUND_LEVEL_TABLE_ROWS.length - 1 ? 1 : 0,
                },
              ]}>
              <Text style={[styles.tableCell, styles.tableColLevel, { color: row.color, fontWeight: '700' }]}>
                {row.level}
              </Text>
              <Text style={[styles.tableCell, styles.tableColExamples, { color: mutedText }]}>
                {row.examples}
              </Text>
              <Text style={[styles.tableCell, styles.tableColRisk, { color: row.color }]}>
                {row.risk}
              </Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <PrimaryButton label='Back to dashboard' variant='secondary' onPress={() => router.back()} disabled={isSyncing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  meterPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  timerLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  dbValue: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  riskBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4, alignSelf: 'flex-start' },
  riskLabel: { ...Typography.small, fontWeight: '700' },
  inputLabel: { ...Typography.small, marginTop: Spacing.sm },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, ...Typography.body, marginTop: 4 },
  buttons: { gap: Spacing.sm, marginTop: Spacing.sm },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between' },
  helper: { ...Typography.small },
  placeholder: { ...Typography.body, fontSize: 13 },
  measureList: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.sm },
  measureRow: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  measureAction: { ...Typography.small, fontWeight: '700' },
  measureDb: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
  tableColLevel: { width: 72 },
  tableColExamples: { flex: 1 },
  tableColRisk: { flex: 1 },
});