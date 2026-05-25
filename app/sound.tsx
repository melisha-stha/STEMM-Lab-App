import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadSoundResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

function getDbRisk(db: number): { label: string; color: string } {
  if (db < 30) return { label: 'No Risk', color: '#2E7D32' }; //
  if (db < 60) return { label: 'Safe', color: '#558B2F' }; //
  if (db < 85) return { label: 'Long Exposure Risk', color: '#F9A825' }; //
  if (db < 90) return { label: 'Hearing Damage Possible', color: '#EF6C00' }; //
  if (db < 100) return { label: 'Hearing Damage Likely', color: '#E53935' }; //
  if (db < 110) return { label: 'Serious Damage', color: '#B71C1C' }; //
  if (db < 120) return { label: 'Painful', color: '#880E4F' }; //
  if (db < 130) return { label: 'Severe Damage', color: '#4A148C' }; //
  return { label: 'Instant Permanent Damage', color: '#000000' }; //
}

const SOUND_LEVEL_TABLE_ROWS = [
  { level: '0–30 dB', examples: 'Whisper, quiet library', risk: 'No risk', color: '#2E7D32' }, //
  { level: '30–60 dB', examples: 'Normal conversation, classroom noise', risk: 'Safe for long periods', color: '#558B2F' }, //
  {
    level: '60–85 dB',
    examples: 'Busy traffic, vacuum cleaner',
    risk: 'Generally safe, but long exposure can cause fatigue',
    color: '#F9A825',
  }, //
  {
    level: '85–90 dB',
    examples: 'Lawn mower, loud classroom, heavy traffic',
    risk: 'Hearing damage possible after long exposure',
    color: '#EF6C00',
  }, //
  {
    level: '90–100 dB',
    examples: 'Motorbike, power tools, loud music',
    risk: 'Hearing damage likely after short exposure',
    color: '#E53935',
  }, //
  {
    level: '100–110 dB',
    examples: 'Nightclub, rock concert, chainsaw',
    risk: 'Serious hearing damage in minutes',
    color: '#B71C1C',
  }, //
  {
    level: '110–120 dB',
    examples: 'Siren close by, car horn at 1 m',
    risk: 'Painful; immediate damage possible',
    color: '#880E4F',
  }, //
  {
    level: '120–130 dB',
    examples: 'Jet engine at close range',
    risk: 'Immediate and severe hearing damage',
    color: '#4A148C',
  }, //
  {
    level: '140+ dB',
    examples: 'Explosion, gunshot',
    risk: 'Instant, permanent hearing damage',
    color: '#000000',
  }, //
] as const;

function meterToDb(meter: number): number {
  const clamped = Math.max(-160, Math.min(0, meter));
  return Math.round(((clamped + 160) / 160) * 120);
}

export default function SoundScreen() {
  const router = useRouter();
  
  // Navigation View State Configuration
  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  
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
  const onPrimary = useThemeColor({}, 'onPrimary');

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
      100
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

      {/* Synchronized Segmented Layout Switcher Row */}
      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isSelected = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[styles.tabPill, { backgroundColor: isSelected ? primary : card, borderColor: isSelected ? primary : border }]}
            >
              <Text style={[styles.tabPillText, { color: isSelected ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {screenTab === 'overview' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.title, { color: text }]}>Sound Pollution Hunter</Text>
            <Text style={[styles.subtitle, { color: mutedText, fontWeight: '600', marginTop: 2 }]}>
              Environmental Science
            </Text>
            <Text style={[styles.body, { color: text, marginTop: Spacing.sm, lineHeight: 20 }]}>
              Students measure and compare sound intensity levels produced across various localized classroom activities.
            </Text>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Equipment</Text>
            <View style={styles.bullets}>
              <Text style={[styles.bullet, { color: text }]}>• Mobile phone fitted with STEMM Lab app</Text>
            </View>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Instructions</Text>
            <View style={styles.bullets}>
              <Text style={[styles.bullet, { color: text, lineHeight: 19 }]}>
                1. Measure acoustics generated from distinct systemic actions (e.g., dropping objects like pens or books, talking, walking, or stamping your feet).
              </Text>
              <Text style={[styles.bullet, { color: text, lineHeight: 19 }]}>
                2. Explicitly log maximum sound pressure outputs alongside exact physical room location tags.
              </Text>
              <Text style={[styles.bullet, { color: text, lineHeight: 19 }]}>
                3. Chart dynamic variations across your school space to map isolated loud and quiet operational zones.
              </Text>
            </View>

            <View style={[styles.diagramPlaceholderBox, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.diagramText, { color: mutedText }]}>
                [Diagram Reference: Dropping object (e.g. book) on table/floor. Position phone exactly 30 cm from the baseline source node].
              </Text>
            </View>
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 2: EXPERIMENT ==================== */}
      {screenTab === 'experiment' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Data Acquisition Instructions</Text>
            <View style={styles.bullets}>
              <Text style={[styles.bullet, { color: mutedText }]}>• Label the action before recording (e.g. "dropping a book").</Text>
              <Text style={[styles.bullet, { color: mutedText }]}>• Tap Start and perform the action exactly 30cm near the phone.</Text>
              <Text style={[styles.bullet, { color: mutedText }]}>• Tap Stop to record the peak amplitude level.</Text>
              <Text style={[styles.bullet, { color: mutedText }]}>• Record up to 3 distinct physical actions to populate your baseline baseline stack.</Text>
            </View>
          </SectionCard>

          {/* Core Hardware Level Meter Component Canvas */}
          <View style={[styles.meterPanel, { borderColor: border, backgroundColor: card }]}>
            <Text style={[styles.timerLabel, { color: mutedText }]}>Live Sensor Sound Level</Text>
            <Text style={[styles.dbValue, { color: risk.color }]}>{liveDb} dB</Text>
            <View style={[styles.riskBadge, { backgroundColor: risk.color + '18', borderColor: risk.color }]}>
              <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
            </View>

            <Text style={[styles.inputLabel, { color: mutedText }]}>Action Label Description</Text>
            <TextInput
              style={[styles.input, { borderColor: border, color: text, backgroundColor: background }]}
              placeholder='e.g. dropping a textbook on desk'
              placeholderTextColor={mutedText}
              value={actionLabel}
              onChangeText={setActionLabel}
              editable={!isRecording && measurements.length < 3}
            />

            <View style={styles.buttons}>
              <PrimaryButton
                label={isRecording ? 'Stop & Record Node' : 'Start Microphone Capture'}
                variant={isRecording ? 'danger' : 'primary'}
                disabled={measurements.length >= 3 || isSyncing}
                onPress={() => isRecording ? stopRecording() : startRecording()}
              />
              <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label='Reset Stack'
                    variant='secondary'
                    onPress={resetAll}
                    disabled={isSyncing || (measurements.length === 0 && !isRecording)}
                  />
                </View>
                <View style={{ flex: 1.3 }}>
                  <PrimaryButton
                    label={isSyncing ? 'Syncing...' : 'Upload Lab Matrix'}
                    variant='secondary'
                    onPress={finishAndSave}
                    disabled={measurements.length === 0 || isRecording || isSyncing}
                    style={{ borderColor: primary }}
                  />
                </View>
              </View>
            </View>

            <View style={styles.helperRow}>
              <Text style={[styles.helper, { color: mutedText }]}>Trial Stack Count: {measurements.length}/3</Text>
              {loudest !== null && (
                <Text style={[styles.helper, { color: primary, fontWeight: '700' }]}>Peak Intensity: {loudest} dB</Text>
              )}
            </View>
          </View>

          {/* Captured Array Measurements Monitor List */}
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Logged Trial Matrices</Text>
            {measurements.length === 0 ? (
              <Text style={[styles.placeholder, { color: mutedText, fontStyle: 'italic' }]}>Awaiting micro-sensor hardware updates.</Text>
            ) : (
              <View style={styles.measureList}>
                {measurements.map((m, i) => {
                  const r = getDbRisk(m.db);
                  const isLoudest = m.db === loudest;
                  return (
                    <View key={i} style={[styles.measureRow, { borderColor: isLoudest ? r.color : border, backgroundColor: card }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.measureAction, { color: text }]}>Action {i + 1}: {m.label}</Text>
                        <Text style={[styles.measureDb, { color: r.color }]}>{m.db} dB</Text>
                      </View>
                      <View style={[styles.riskBadge, { backgroundColor: r.color + '15', borderColor: r.color }]}>
                        <Text style={[styles.riskLabel, { color: r.color }]}>
                          {isLoudest ? '🔊 Peak Value' : r.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 3: WRITE-UP ==================== */}
      {screenTab === 'writeup' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Write-up Reference Prompts</Text>
            <Text style={[styles.body, { color: mutedText, fontStyle: 'italic', marginBottom: Spacing.sm }]}>
              Use these inquiry steps as a guideline for your physical paper curriculum worksheets:
            </Text>
            <View style={styles.promptListContainer}>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Predict which isolated school action creates the highest acoustic sound intensity.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Document and safely log the recorded decibel metrics into your worksheet ledger.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Were your physical hypotheses correct when verified against sensor outcomes?</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Did you encounter any abnormal spike deviations or unexpected data surprises?</Text>
              <Text style={[styles.bulletPrompt, { color: text, fontWeight: '600' }]}>• Critical Safety Analysis: Should students or teachers wear protective earmuffs inside your active classroom?</Text>
            </View>
          </SectionCard>

          {/* Paper Worksheet Log Layout Table */}
          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, marginBottom: Spacing.xs }]}>Worksheet Reference Table</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={[styles.matrixTableGrid, { borderColor: border }]}>
                <View style={[styles.matrixHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 140 }]}>Action Sequence</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 150 }]}>Prediction (Louder / Softer)</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 110 }]}>Outcome (dB)</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 110 }]}>Hypothesis Correct?</Text>
                </View>

                {[
                  { id: '1', label: 'Action 1: Drop Book on Table' },
                  { id: '2', label: 'Action 2: Guided Entry' },
                  { id: '3', label: 'Action 3: Guided Entry' }
                ].map((row, idx) => (
                  <View key={row.id} style={[styles.matrixDataRow, { borderBottomWidth: idx === 2 ? 0 : 1, borderBottomColor: border }]}>
                    <Text style={[styles.tableBodyCell, { color: text, fontWeight: '600', width: 140 }]}>{row.label}</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 150 }]}>Fill on worksheet paper...</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 110 }]}>Fill on worksheet paper...</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 110 }]}>[  ] Yes  /  [  ] No</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={[styles.fieldSubHintText, { color: mutedText, marginTop: Spacing.xs, textAlign: 'center' }]}>
              All cell sectors match physical print sheets—fill out completely during classroom testing loops.
            </Text>
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 4: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Acoustic Mechanics & Threshold Property Analysis</Text>
            <Text style={[styles.body, { color: text, lineHeight: 19 }]}>
              Sound intensity measurements vary depending directly on the mechanical kinetic energy input of the collision source and the physical density profile of contact surface structures. Prolonged exposure to severe noise pollution can heavily impact overall health, mental concentration, and auditory performance loops.
            </Text>
          </SectionCard>

          {/* Reference Injury Risk Matrix Guide Table */}
          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, marginBottom: Spacing.xs }]}>Hearing Damage Safety Grid</Text>
            <View style={[styles.table, { borderColor: border }]}>
              <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
                <Text style={[styles.tableHeaderCell, styles.tableColLevel, { color: text }]}>Sound Level</Text>
                <Text style={[styles.tableHeaderCell, styles.tableColExamples, { color: text }]}>Example Sounds</Text>
                <Text style={[styles.tableHeaderCell, styles.tableColRisk, { color: text }]}>Risk to Hearing</Text>
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
                  <Text style={[styles.tableCell, styles.tableColExamples, { color: text }]}>
                    {row.examples}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableColRisk, { color: row.color, fontWeight: '600' }]}>
                    {row.risk}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>

          {/* Educational Framework Curriculum Trackers */}
          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, fontSize: 13, marginBottom: 4 }]}>Curriculum Links Reference</Text>
            <Text style={[styles.bullet, { color: text, fontSize: 12 }]}>• Science (Physics): ACSSU073 – Wave mechanics, sound intensity, and kinetic energy properties.</Text>
            <Text style={[styles.bullet, { color: text, fontSize: 12, marginTop: 2 }]}>• Health & Safety: ACPPS053 – Environmental hazard controls and auditory wellbeing.</Text>
          </SectionCard>
        </View>
      )}

      <PrimaryButton label='Back to dashboard' variant='secondary' onPress={() => router.back()} disabled={isSyncing} style={{ marginTop: Spacing.xs }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  
  // Segmented View Controllers
  tabRow: { flexDirection: 'row', gap: Spacing.xs },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPillText: { ...Typography.small, fontWeight: '700', fontSize: 11 },
  
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bullets: { gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },

  body: { ...Typography.body, fontSize: 13, lineHeight: 18 },
  
  // Meter Layout Deck
  meterPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  timerLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  dbValue: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  riskBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4, alignSelf: 'flex-start', justifyContent: 'center' },
  riskLabel: { ...Typography.small, fontWeight: '700', fontSize: 11 },
  inputLabel: { ...Typography.small, marginTop: Spacing.xs },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, ...Typography.body, marginTop: 4 },
  buttons: { gap: Spacing.xs, marginTop: Spacing.xs },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  helper: { ...Typography.small },
  placeholder: { ...Typography.body, fontSize: 13 },
  
  // Measurement Rows
  measureList: { gap: Spacing.xs },
  measureRow: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  measureAction: { ...Typography.small, fontWeight: '700' },
  measureDb: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  
  // Multi-column Grid Vectors
  matrixTableGrid: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  matrixHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: Spacing.sm },
  matrixDataRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  promptListContainer: { gap: 6, marginVertical: Spacing.xs },
  bulletPrompt: { ...Typography.body, fontSize: 13, lineHeight: 18 },
  
  // Base Tables
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'flex-start', gap: Spacing.xs },
  tableBodyCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
  tableColLevel: { width: 72 },
  tableColExamples: { flex: 1 },
  tableColRisk: { flex: 1 },
  
  diagramPlaceholderBox: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  diagramText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', lineHeight: 17 },
  bodyHeading: { ...Typography.section, fontSize: 14, fontWeight: '700' },
  fieldSubHintText: { ...Typography.small, fontSize: 10 }
});