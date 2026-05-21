import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadPerformanceResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

const MOVEMENTS = [
  { label: 'Movement 1', description: 'Rotate your hand in a circle, then in a figure-8 pattern.' },
  { label: 'Movement 2', description: 'Move your hand slowly up and down in a straight line.' },
  { label: 'Movement 3', description: 'Rotate your hand side to side at shoulder height.' },
];

type Attempt = {
  movement: string;
  peakForce: number;
  averageForce: number;
  durationSec: number;
};

export default function PerformanceScreen() {
  const router = useRouter();
  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentMovementIndex, setCurrentMovementIndex] = useState(0);
  const [liveForce, setLiveForce] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [locationStatus, setLocationStatus] = useState('Searching...');

  const subscriptionRef = useRef<any>(null);
  const peakForceRef = useRef(0);
  const forceReadingsRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  const onPrimary = useThemeColor({}, 'onPrimary');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
    return () => stopSensor();
  }, []);

  const getScoreLabel = (avg: number): { label: string; color: string } => {
    if (avg < 1.2) return { label: 'Excellent — Very smooth', color: '#4CAF50' };
    if (avg < 1.8) return { label: 'Good — Moderate control', color: '#FF9800' };
    return { label: 'Needs practice — Fast movement', color: '#FF4444' };
  };

  const startSensor = () => {
    if (Platform.OS === 'web') return;
    peakForceRef.current = 0;
    forceReadingsRef.current = [];
    startTimeRef.current = Date.now();
    Accelerometer.setUpdateInterval(100);
    subscriptionRef.current = Accelerometer.addListener(data => {
      const force = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      setLiveForce(force);
      if (force > peakForceRef.current) peakForceRef.current = force;
      forceReadingsRef.current.push(force);
    });
    setIsActive(true);
  };

  const stopSensor = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsActive(false);
  };

  const stopAndRecord = () => {
    stopSensor();
    const readings = forceReadingsRef.current;
    if (readings.length === 0) return;

    const avgForce = readings.reduce((a, b) => a + b, 0) / readings.length;
    const duration = (Date.now() - startTimeRef.current) / 1000;
    const movement = MOVEMENTS[currentMovementIndex];

    const newAttempt: Attempt = {
      movement: movement.label,
      peakForce: Math.round(peakForceRef.current * 100) / 100,
      averageForce: Math.round(avgForce * 100) / 100,
      durationSec: Math.round(duration * 10) / 10,
    };

    setAttempts(prev => [...prev, newAttempt]);
    setLiveForce(0);

    if (currentMovementIndex < MOVEMENTS.length - 1) {
      setCurrentMovementIndex(prev => prev + 1);
    }
  };

  const resetAll = () => {
    stopSensor();
    setAttempts([]);
    setCurrentMovementIndex(0);
    setLiveForce(0);
  };

  const handleSave = async () => {
    if (!attempts.length) return;
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
      const bestAvg = Math.min(...attempts.map(a => a.averageForce));

      await Promise.all([
        uploadPerformanceResult(user.uid, teamData, attempts, locationData),
        Promise.resolve(insertTrial(
          teamData?.name || 'unknown',
          'performance',
          Math.round(bestAvg * 1000),
          '',
          locationData?.latitude || null,
          locationData?.longitude || null
        ))
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Performance results for ${teamData?.name || 'your team'} have been saved!`,
          data: { screen: 'performance' },
        },
        trigger: null,
      });

      Alert.alert('Saved!', 'Your performance results have been saved.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error) {
      console.error('Performance Save Error:', error);
      Alert.alert('Save Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const renderOverviewTab = () => (
    <SectionCard>
      <Text style={[styles.heroTitle, { color: text }]}>Human Performance Lab</Text>
      <Text style={[styles.heroSubtitle, { color: mutedText }]}>Medical Science + Biomechanics</Text>
      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Students investigate how the human body moves by measuring speed, smoothness, and coordination during controlled stretching activities. The phone's accelerometer measures how gracefully you move — the lower the reading, the smoother the movement.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Mobile phone with STEMM Lab app</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Open space to move safely</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>1. Hold the phone firmly in one hand.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>2. Press Start on the Experiment tab.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>3. Perform the guided movement as slowly and smoothly as possible.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>4. Press Stop to record your score.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>5. Complete all 3 movements and compare results.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>6. Save and reflect as a group.</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>The 3 Movements</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        {MOVEMENTS.map((m, i) => (
          <View key={i} style={styles.movementRow}>
            <Text style={[styles.movementLabel, { color: primary }]}>{m.label}:</Text>
            <Text style={[styles.bullet, { color: mutedText, flex: 1 }]}>{m.description}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.diagramCard, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.diagramText, { color: mutedText }]}>
          [Diagram: Student holding phone with direction of movement arrows for each of the 3 movements]
        </Text>
      </View>
    </SectionCard>
  );

  const renderExperimentTab = () => {
    const currentMovement = MOVEMENTS[currentMovementIndex];
    const allDone = attempts.length >= MOVEMENTS.length;
    const score = getScoreLabel(liveForce);

    return (
      <View style={styles.experimentWrap}>
        <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.helper, { color: mutedText }]}>GPS Status: {locationStatus}</Text>
          <Text style={[styles.helper, { color: mutedText, marginTop: 4 }]}>
            Attempts recorded: {attempts.length}/{MOVEMENTS.length}
          </Text>
        </View>

        {!allDone && (
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>{currentMovement.label}</Text>
            <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.md }]}>
              {currentMovement.description}
            </Text>

            <Text style={[styles.inputLabel, { color: mutedText }]}>Live Sensor Reading</Text>
            <Text style={[styles.liveForce, { color: isActive ? score.color : mutedText }]}>
              {liveForce.toFixed(2)} g
            </Text>
            {isActive && (
              <Text style={[styles.scoreLabel, { color: score.color }]}>{score.label}</Text>
            )}

            <View style={styles.buttonRow}>
              <PrimaryButton
                label={isActive ? 'Stop & Record' : 'Start Movement'}
                variant={isActive ? 'danger' : 'primary'}
                onPress={isActive ? stopAndRecord : startSensor}
                disabled={isSyncing}
                style={{ flex: 1 }}
              />
              <View style={{ width: Spacing.sm }} />
              <PrimaryButton
                label="Reset"
                variant="secondary"
                onPress={resetAll}
                disabled={isSyncing || (attempts.length === 0 && !isActive)}
                style={{ flex: 1 }}
              />
            </View>
          </SectionCard>
        )}

        {attempts.length > 0 && (
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Recorded Movements</Text>
            {attempts.map((a, i) => {
              const s = getScoreLabel(a.averageForce);
              return (
                <View key={i} style={[styles.attemptRow, { borderTopColor: border, borderTopWidth: i === 0 ? 0 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bodyHeading, { color: text }]}>{a.movement}</Text>
                    <Text style={[styles.body, { color: mutedText }]}>
                      Average: {a.averageForce} g  |  Peak: {a.peakForce} g  |  Duration: {a.durationSec}s
                    </Text>
                  </View>
                  <View style={[styles.scoreBadge, { backgroundColor: s.color + '22', borderColor: s.color }]}>
                    <Text style={[styles.scoreBadgeText, { color: s.color }]}>
                      {a.averageForce < 1.2 ? 'Excellent' : a.averageForce < 1.8 ? 'Good' : 'Needs Practice'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </SectionCard>
        )}

        {allDone && (
          <PrimaryButton
            label={isSyncing ? 'Saving...' : 'Finish & Save Results'}
            onPress={handleSave}
            disabled={isSyncing}
            style={{ borderColor: primary }}
          />
        )}
      </View>
    );
  };

  const renderWriteupTab = () => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Write-up (on paper)</Text>
      <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.md }]}>
        Use the questions below to complete your write-up in your exercise book.
      </Text>

      {[
        'Which movement was the hardest to keep the vibration low?',
        'Record the results.',
        'Were you right? Any surprises?',
      ].map((q, i) => (
        <View key={i} style={[styles.questionBlock, { borderTopColor: border }]}>
          <Text style={[styles.questionNumber, { color: primary }]}>{i + 1}.</Text>
          <Text style={[styles.questionText, { color: text }]}>{q}</Text>
        </View>
      ))}

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Table Template</Text>
      <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.sm }]}>Copy this table into your exercise book.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.table, { borderColor: border, minWidth: 520 }]}>
          <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
            {['', 'Predict Phone Vibration (absolute)', 'Outcome (time + movement)', 'Were you right?'].map((h, i) => (
              <Text key={i} style={[styles.tableHeaderCell, { color: text, width: i === 0 ? 100 : 140 }]}>{h}</Text>
            ))}
          </View>
          {['Attempt 1', 'Attempt 2', 'Attempt 3'].map((label, i) => (
            <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? background : card, borderBottomColor: border, borderBottomWidth: i < 2 ? 1 : 0 }]}>
              <Text style={[styles.tableCell, { color: text, width: 100, fontWeight: '700' }]}>{label}</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 140 }]}>e.g. +/- 1cm</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 140 }]}>{i === 0 ? '5mm in 20 seconds' : i === 1 ? '5mm in 5 seconds' : ' '}</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 140 }]}> </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SectionCard>
  );

  const renderDiscussionTab = () => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Discussion</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Muscles and joints work together to create movement. Faster movements often reduce control, while smoother movements show better coordination. Sensors in the phone measure how quickly and smoothly the body moves, helping students understand biomechanics and fatigue.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Why does speed reduce control?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        When you move faster, your muscles have less time to make fine adjustments. This causes more wobble and higher accelerometer readings. Slow, deliberate movements allow your nervous system to continuously correct your path.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>What does the sensor actually measure?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        The accelerometer measures g-force — the rate of change in velocity in all three directions (x, y, z). When you move smoothly, these values stay close to 1g (gravity). Sudden jerks or fast movements spike the readings above 1g.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Curriculum Links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>Health & Physical Education:</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACPPS051 — Movement skills</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACPPS054 — Physical performance</Text>
        <Text style={[styles.bullet, { color: mutedText, marginTop: Spacing.xs }]}>Science (Biology):</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACSSU176 — Structure and function of body systems</Text>
      </View>
    </SectionCard>
  );

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map(tab => {
          const isActive = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[styles.tabPill, { backgroundColor: isActive ? primary : card, borderColor: isActive ? primary : border }]}
            >
              <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'overview' && renderOverviewTab()}
      {screenTab === 'experiment' && renderExperimentTab()}
      {screenTab === 'writeup' && renderWriteupTab()}
      {screenTab === 'discussion' && renderDiscussionTab()}

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} disabled={isSyncing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  tabPillText: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  heroTitle: { ...Typography.hero, fontSize: 26 },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bodyHeading: { ...Typography.section, fontSize: 14, marginBottom: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  movementRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: 6 },
  movementLabel: { ...Typography.small, fontWeight: '700', minWidth: 90 },
  diagramCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  diagramText: { ...Typography.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  experimentWrap: { gap: Spacing.md },
  infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  helper: { ...Typography.small },
  inputLabel: { ...Typography.small, marginBottom: 4 },
  liveForce: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: Spacing.sm },
  scoreLabel: { ...Typography.body, fontWeight: '600', marginBottom: Spacing.sm },
  buttonRow: { flexDirection: 'row', marginTop: Spacing.sm },
  attemptRow: { paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scoreBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  scoreBadgeText: { ...Typography.small, fontWeight: '700' },
  questionBlock: { flexDirection: 'row', gap: Spacing.sm, borderTopWidth: 1, paddingVertical: Spacing.sm, alignItems: 'flex-start' },
  questionNumber: { ...Typography.section, fontSize: 14, minWidth: 20 },
  questionText: { ...Typography.body, fontSize: 13, lineHeight: 20, flex: 1 },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'flex-start' },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
});