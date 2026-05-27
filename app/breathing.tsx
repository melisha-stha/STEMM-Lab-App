import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import type { BreathingSession as BaseBreathingSession } from '@/hooks/firestore';
import { uploadBreathingResult } from '@/hooks/firestore';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

const ACTIVITY_BREATHING = 'breathing';
const SESSION_COUNT = 3;
const SESSION_DURATION_MS = 30000; // 30-second measurement window
const ACCELEROMETER_INTERVAL = 100;
const BAR_MAX_HEIGHT = 120;
const BAR_MIN_HEIGHT = 8;

const SESSION_LABELS: readonly [string, string, string] = [
  'At Rest',
  'After Exercise 1 — Jog 1 minute or 100 star jumps',
  'After Exercise 2 — Repeat exercise',
];

const SESSION_SHORT_LABELS: readonly [string, string, string] = [
  'At Rest',
  'After Exercise 1',
  'After Exercise 2',
];

type ScreenTab = 'instructions' | 'activity' | 'discussion';
type ActivityStep = 'ready' | 'recording' | 'session_done' | 'exercise' | 'summary';

interface ExtendedBreathingAttempt {
  memberName: string;
  sessionIndex: number;
  label: string;
  bpm: number;
}

const SCREEN_TABS: ScreenTab[] = ['instructions', 'activity', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  instructions: 'Instructions',
  activity: 'Activity',
  discussion: 'Discussion',
};

const calculateBPM = (zValues: number[]): number => {
  if (zValues.length < 15) return 0;

  // 1. Isolate relative motion by filtering out the 1.0g gravity baseline
  const movementDeltas = zValues.map((val) => Math.abs(val - 1.0));

  // 2. Smooth signal noise using a moving average window
  const windowSize = 4;
  const smoothed: number[] = [];
  for (let i = 0; i < movementDeltas.length; i++) {
    const start = Math.max(0, i - windowSize);
    const subset = movementDeltas.slice(start, i + 1);
    const avg = subset.reduce((sum, v) => sum + v, 0) / subset.length;
    smoothed.push(avg);
  }

  // 3. Peak-to-trough detection thresholding
  const meanDelta = smoothed.reduce((sum, v) => sum + v, 0) / smoothed.length;
  let peakCount = 0;

  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1] &&
      smoothed[i] > meanDelta + 0.005 // Verifies substantial chest expansion movement
    ) {
      peakCount++;
    }
  }

  // 4. Extrapolate 30-second sample counts up to a full 60-second minute value
  const totalSecondsLogged = (zValues.length * ACCELEROMETER_INTERVAL) / 1000;
  const scalingFactor = 60 / totalSecondsLogged;
  
  const estimatedBpm = Math.round(peakCount * scalingFactor);
  return Math.max(8, Math.min(48, estimatedBpm)); // Filters out noise into standard physiological limits
};

const formatCountdown = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  return `${seconds}s`;
};

export default function BreathingScreen() {
  const router = useRouter();

  const [screenTab, setScreenTab] = useState<ScreenTab>('instructions');
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [activityStep, setActivityStep] = useState<ActivityStep>('ready');
  const [countdownMs, setCountdownMs] = useState(SESSION_DURATION_MS);
  const [liveZ, setLiveZ] = useState(1.0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [memberName, setMemberName] = useState('');
  const [attempts, setAttempts] = useState<ExtendedBreathingAttempt[]>([]);

  const zReadings = useRef<number[]>([]);
  const accelSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary' as any) ?? '#FFFFFF';

  // Dynamic visual height calculation for the live chest movement bar
  const liveBarHeight = useMemo(() => {
    const relativeMotion = Math.abs(liveZ - 1.0);
    const clamped = Math.max(0, Math.min(0.3, relativeMotion)); 
    return BAR_MIN_HEIGHT + (clamped / 0.3) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
  }, [liveZ]);

  // Filters attempts for the current active participant
  const currentMemberAttempts = useMemo(() => {
    return attempts.filter((a) => a.memberName === memberName.trim());
  }, [attempts, memberName]);

  const restingBpm = currentMemberAttempts.find((s) => s.sessionIndex === 0)?.bpm ?? null;
  const exercise1Bpm = currentMemberAttempts.find((s) => s.sessionIndex === 1)?.bpm ?? null;
  const exercise2Bpm = currentMemberAttempts.find((s) => s.sessionIndex === 2)?.bpm ?? null;

  const clearRecordingTimers = (): void => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (recordingStopRef.current) clearTimeout(recordingStopRef.current);
    countdownIntervalRef.current = null;
    recordingStopRef.current = null;
  };

  const stopAccelerometer = (): void => {
    accelSubscriptionRef.current?.remove();
    accelSubscriptionRef.current = null;
  };

  const finishRecording = (): void => {
    stopAccelerometer();
    clearRecordingTimers();

    const bpm = calculateBPM(zReadings.current);
    const label = SESSION_LABELS[currentSessionIndex];
    const currentName = memberName.trim();

    // Log the completed trial run directly into the participant array
    setAttempts((prev) => [
      ...prev.filter((a) => !(a.memberName === currentName && a.sessionIndex === currentSessionIndex)),
      { memberName: currentName, sessionIndex: currentSessionIndex, label, bpm },
    ]);

    if (currentSessionIndex >= SESSION_COUNT - 1) {
      setActivityStep('summary');
    } else {
      setActivityStep('session_done');
    }
  };

  const startRecording = (): void => {
    if (!memberName.trim()) {
      Alert.alert('Name Required', 'Please input a student name to track your session details.');
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Sensor unavailable', 'Accelerometer is not available on web.');
      return;
    }

    zReadings.current = [];
    setCountdownMs(SESSION_DURATION_MS);
    setActivityStep('recording');

    Accelerometer.setUpdateInterval(ACCELEROMETER_INTERVAL);
    accelSubscriptionRef.current = Accelerometer.addListener(({ z }) => {
      zReadings.current.push(z);
      setLiveZ(z);
    });

    countdownIntervalRef.current = setInterval(() => {
      setCountdownMs((prev) => Math.max(0, prev - ACCELEROMETER_INTERVAL));
    }, ACCELEROMETER_INTERVAL);

    recordingStopRef.current = setTimeout(() => {
      finishRecording();
    }, SESSION_DURATION_MS);
  };

  useEffect(() => {
    return () => {
      stopAccelerometer();
      clearRecordingTimers();
    };
  }, []);

  const handleSessionContinue = (): void => {
    if (currentSessionIndex < SESSION_COUNT - 1) {
      setActivityStep('exercise');
    } else {
      setActivityStep('summary');
    }
  };

  const handleExerciseReady = (): void => {
    setCurrentSessionIndex((prev) => prev + 1);
    setActivityStep('ready');
  };

  // Preps the screen setup for another user or loop execution run
  const resetForNextMemberSetup = (): void => {
    stopAccelerometer();
    clearRecordingTimers();
    setCurrentSessionIndex(0);
    setCountdownMs(SESSION_DURATION_MS);
    setLiveZ(1.0);
    setMemberName('');
    setActivityStep('ready');
  };

  const saveResults = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Sign in required', 'Please log in to save your results.');
    if (currentMemberAttempts.length < SESSION_COUNT) {
      return Alert.alert('Incomplete sessions', 'Please complete all 3 recording sessions for this user.');
    }

    setIsSyncing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationData = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      const teamData = await getTeamData();
      
      // Map the current participant's session entries into the required Firestore schema format
      const formattedPayload: BaseBreathingSession[] = currentMemberAttempts.map((a) => ({
        label: a.label,
        bpm: a.bpm,
        duration: SESSION_DURATION_MS,
      }));

      await Promise.all([
        uploadBreathingResult(user.uid, teamData, formattedPayload, locationData),
        Promise.resolve(
          insertTrial(teamData?.name || 'unknown', ACTIVITY_BREATHING, restingBpm ?? 0, '', locationData?.latitude ?? null, locationData?.longitude ?? null)
        ),
      ]);

      Alert.alert('Upload Successful', 'Your team session updates were safely sent to the cloud database dashboard.');
    } catch (error) {
      console.error('Breathing save error:', error);
      Alert.alert('Sync Error', 'Could not establish connection with database storage pipelines.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Breathing Pace Trainer</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Biology + Physical Activity Response</Text>
      </View>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isActive = screenTab === tab;
          return (
            <Pressable key={tab} onPress={() => setScreenTab(tab)} style={[styles.tabPill, { backgroundColor: isActive ? primary : card, borderColor: isActive ? primary : border }]}>
              <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>{SCREEN_TAB_LABELS[tab]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ==================== TAB 1: INSTRUCTIONS ==================== */}
      {screenTab === 'instructions' && (
        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Overview</Text>
          <Text style={[styles.body, { color: mutedText, lineHeight: 19 }]}>
            Students analyse chest expansion breathing frequency shifts at rest and after intense aerobic exercise routines.
          </Text>
          <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions Layout</Text>
          <View style={[styles.bullets, { borderTopColor: border }]}>
            <Text style={[styles.bullet, { color: text }]}>1. Enter your participant identity label inside the field box bounds.</Text>
            <Text style={[styles.bullet, { color: text }]}>2. Lie down flat, rest the phone directly over your chest center plate, and tap start.</Text>
            <Text style={[styles.bullet, { color: text }]}>3. Run through all three distinct resting and post-exercise challenge sequences sequentially.</Text>
          </View>
        </SectionCard>
      )}

      {/* ==================== TAB 2: ACTIVE DIAGNOSTICS ==================== */}
      {screenTab === 'activity' && (
        <View style={styles.activityWrap}>
          <View style={[styles.instrumentPanelBox, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.inputFieldLabelText, { color: text }]}>Participant Student Name</Text>
            <TextInput
              style={[styles.inputFieldBoxFrame, { borderColor: border, color: text, backgroundColor: background }]}
              placeholder="Enter active name..."
              placeholderTextColor={mutedText}
              value={memberName}
              onChangeText={setMemberName}
              editable={activityStep === 'ready' || activityStep === 'summary'}
            />

            {activityStep !== 'summary' && memberName.trim().length > 0 && (
              <Text style={[styles.sessionIndicator, { color: text }]}>
                Session {currentSessionIndex + 1} of {SESSION_COUNT} — {SESSION_SHORT_LABELS[currentSessionIndex]}
              </Text>
            )}

            {activityStep === 'exercise' && (
              <View style={styles.exerciseAlertCard}>
                <Text style={[styles.exerciseTitle, { color: text }]}>🏃‍♂️ Time to exercise!</Text>
                <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.sm }]}>
                  Jog on the spot for 1 minute or carry out 100 star jumps. Tap ready when your chest is pounding.
                </Text>
                <PrimaryButton label="Ready to Measure" onPress={handleExerciseReady} />
              </View>
            )}

            {(activityStep === 'ready' || activityStep === 'recording' || activityStep === 'session_done') && (
              <View style={styles.activityBlock}>
                <Text style={[styles.instruction, { color: mutedText }]}>
                  Place phone flat on your chest and breathe normally
                </Text>

                <View style={[styles.indicatorCard, { borderColor: border, backgroundColor: background }]}>
                  <View style={[styles.barTrack, { backgroundColor: card }]}>
                    <View style={[styles.barFill, { height: liveBarHeight, backgroundColor: activityStep === 'recording' ? primary : border }]} />
                  </View>

                  {activityStep === 'recording' && (
                    <>
                      <Text style={[styles.recordingLabel, { color: primary }]}>LOGGING CHEST MOTION…</Text>
                      <Text style={[styles.countdown, { color: text }]}>{formatCountdown(countdownMs)}</Text>
                    </>
                  )}

                  {activityStep === 'session_done' && (
                    <Text style={[styles.bpmResult, { color: primary }]}>
                      {currentMemberAttempts.find((a) => a.sessionIndex === currentSessionIndex)?.bpm ?? 0} BPM
                    </Text>
                  )}
                </View>

                {activityStep === 'ready' && (
                  <PrimaryButton label="Start 30s Recording" onPress={startRecording} disabled={!memberName.trim()} />
                )}

                {activityStep === 'session_done' && (
                  <PrimaryButton label="Advance Sequence" variant="secondary" onPress={handleSessionContinue} />
                )}
              </View>
            )}

            {/* Individual Participant Run Summary Breakdown Views */}
            {(activityStep === 'summary' || currentMemberAttempts.length === SESSION_COUNT) && (
              <View style={styles.summaryWrapContainer}>
                <Text style={[styles.sectionTitle, { color: text }]}>{memberName.trim()}&apos;s Session Comparison</Text>
                <View style={[styles.summaryList, { borderTopColor: border }]}>
                  <Text style={[styles.summaryRow, { color: text }]}>At Rest: {restingBpm != null ? `${restingBpm} BPM` : '—'}</Text>
                  <Text style={[styles.summaryRow, { color: text }]}>After Exercise 1: {exercise1Bpm != null ? `${exercise1Bpm} BPM` : '—'}</Text>
                  <Text style={[styles.summaryRow, { color: text }]}>After Exercise 2: {exercise2Bpm != null ? `${exercise2Bpm} BPM` : '—'}</Text>
                  <Text style={[styles.summaryRow, { color: primary, fontWeight: '700' }]}>
                    Delta Shift (Rest → Ex 1): {restingBpm != null && exercise1Bpm != null ? `${exercise1Bpm - restingBpm} BPM Increase` : '—'}
                  </Text>
                </View>
                
                <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                  <PrimaryButton label={isSyncing ? 'Uploading...' : 'Save Member Results'} onPress={saveResults} disabled={isSyncing || currentMemberAttempts.length < SESSION_COUNT} />
                  <PrimaryButton label="Next Team Member Setup" variant="secondary" onPress={resetForNextMemberSetup} style={{ borderStyle: 'dashed', borderColor: primary }} />
                </View>
              </View>
            )}
          </View>

          {/* Persistent global list overview tracking everyone's scores */}
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Active Team Progress Manifest Log</Text>
            {attempts.length === 0 ? (
              <Text style={[styles.bullet, { color: mutedText }]}>No local participant records populated down in this cycle yet.</Text>
            ) : (
              attempts.map((item, index) => (
                <View key={index} style={[styles.attemptRowListItem, { borderBottomColor: border }]}>
                  <Text style={[styles.body, { color: text, fontWeight: '700' }]}>{item.memberName}</Text>
                  <Text style={[styles.body, { color: mutedText }]}>{SESSION_SHORT_LABELS[item.sessionIndex]}: {item.bpm} BPM</Text>
                </View>
              ))
            )}
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 3: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Biology System Insights</Text>
          <Text style={[styles.body, { color: mutedText, lineHeight: 20 }]}>
            Breathing frequencies ramp up dynamically alongside exertion loads to fast-track oxygen cellular transmission into fatigued skeletal muscle fibers. Lying completely supine aligns the phone along structural gravity bounds, transforming the underlying accelerometer into an precise physical chest tracking device.
          </Text>
        </SectionCard>
      )}

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} disabled={isSyncing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 24 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  tabPillText: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  body: { ...Typography.body, fontSize: 13 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13 },
  activityWrap: { gap: Spacing.md },
  sessionIndicator: { ...Typography.section, textAlign: 'center', marginVertical: Spacing.sm, fontWeight: '700' },
  activityBlock: { gap: Spacing.sm },
  instruction: { ...Typography.body, textAlign: 'center', fontWeight: '600', marginBottom: 4 },
  indicatorCard: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, minHeight: 200, justifyContent: 'center' },
  barTrack: { width: 40, height: BAR_MAX_HEIGHT, borderRadius: Radius.md, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: Radius.md },
  recordingLabel: { ...Typography.small, fontWeight: '700', letterSpacing: 1 },
  countdown: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bpmResult: { fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  exerciseTitle: { ...Typography.section, fontSize: 16 },
  summaryList: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  summaryRow: { ...Typography.body, fontSize: 13, paddingVertical: 2 },
  instrumentPanelBox: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.md },
  inputFieldLabelText: { ...Typography.small, fontWeight: '700', marginBottom: 6 },
  inputFieldBoxFrame: { height: 40, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, fontSize: 13, marginBottom: Spacing.xs },
  attemptRowListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  exerciseAlertCard: { padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dotted', marginVertical: Spacing.xs },
  summaryWrapContainer: { gap: Spacing.xs, marginTop: Spacing.sm }
});