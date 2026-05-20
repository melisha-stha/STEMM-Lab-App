import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import type { BreathingSession } from '@/hooks/firestore';
import { uploadBreathingResult } from '@/hooks/firestore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

const ACTIVITY_BREATHING = 'breathing';
const SESSION_COUNT = 3;
const SESSION_DURATION_MS = 30000;
const ACCELEROMETER_INTERVAL = 100;
const BPM_WARNING_MIN = 5;
const BPM_WARNING_MAX = 60;
const BAR_MAX_HEIGHT = 120;
const BAR_MIN_HEIGHT = 8;
const Z_DISPLAY_MIN = -2;
const Z_DISPLAY_MAX = 2;

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

const SCREEN_TABS: ScreenTab[] = ['instructions', 'activity', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  instructions: 'Instructions',
  activity: 'Activity',
  discussion: 'Discussion',
};

const calculateBPM = (zValues: number[]): number => {
  if (zValues.length < 10) return 0;

  const windowSize = 5;
  const smoothed = zValues.map((_, i) => {
    const start = Math.max(0, i - windowSize);
    const slice = zValues.slice(start, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });

  const mean = smoothed.reduce((sum, v) => sum + v, 0) / smoothed.length;
  const threshold = mean + 0.02;

  let peakCount = 0;
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1] &&
      smoothed[i] > threshold
    ) {
      peakCount++;
    }
  }

  return Math.round(peakCount / 0.5);
};

const zToBarHeight = (z: number): number => {
  const normalized = (z - Z_DISPLAY_MIN) / (Z_DISPLAY_MAX - Z_DISPLAY_MIN);
  const clamped = Math.max(0, Math.min(1, normalized));
  return BAR_MIN_HEIGHT + clamped * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
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
  const [sessions, setSessions] = useState<BreathingSession[]>([]);
  const [lastSessionBpm, setLastSessionBpm] = useState<number | null>(null);
  const [countdownMs, setCountdownMs] = useState(SESSION_DURATION_MS);
  const [liveZ, setLiveZ] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

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
  const onPrimary = useThemeColor({}, 'onPrimary');

  const allSessionsComplete = sessions.length >= SESSION_COUNT;

  const restingBpm = useMemo(
    () => sessions.find((s) => s.label === SESSION_LABELS[0])?.bpm ?? null,
    [sessions]
  );
  const exercise1Bpm = useMemo(
    () => sessions.find((s) => s.label === SESSION_LABELS[1])?.bpm ?? null,
    [sessions]
  );
  const exercise2Bpm = useMemo(
    () => sessions.find((s) => s.label === SESSION_LABELS[2])?.bpm ?? null,
    [sessions]
  );

  const clearRecordingTimers = (): void => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (recordingStopRef.current) {
      clearTimeout(recordingStopRef.current);
      recordingStopRef.current = null;
    }
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
    const entry: BreathingSession = {
      label,
      bpm,
      duration: SESSION_DURATION_MS,
    };

    setSessions((prev) => [...prev, entry]);
    setLastSessionBpm(bpm);

    if (currentSessionIndex >= SESSION_COUNT - 1) {
      setActivityStep('summary');
    } else {
      setActivityStep('session_done');
    }
  };

  const startRecording = (): void => {
    if (Platform.OS === 'web') {
      Alert.alert('Sensor unavailable', 'Accelerometer is not available on web.');
      return;
    }

    zReadings.current = [];
    setCountdownMs(SESSION_DURATION_MS);
    setLastSessionBpm(null);
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
    setLastSessionBpm(null);
  };

  const saveResults = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to save your results.');
      return;
    }
    if (sessions.length < SESSION_COUNT) {
      Alert.alert('Incomplete sessions', 'Please complete all 3 recording sessions.');
      return;
    }

    setIsSyncing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationData: { latitude: number; longitude: number } | null = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      const teamData = await getTeamData();
      const resting = sessions.find((s) => s.label === SESSION_LABELS[0]);

      await Promise.all([
        uploadBreathingResult(user.uid, teamData, sessions, locationData),
        Promise.resolve(
          insertTrial(
            teamData?.name || 'unknown',
            ACTIVITY_BREATHING,
            resting?.bpm ?? 0,
            '',
            locationData?.latitude ?? null,
            locationData?.longitude ?? null
          )
        ),
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `${teamData?.name || 'Your team'} — Breathing result saved`,
        },
        trigger: null,
      });

      router.push({
        pathname: '/breathing-results' as '/earthquake-results',
        params: { sessionsJson: JSON.stringify(sessions) },
      });
    } catch (error) {
      console.error('Breathing save error:', error);
      Alert.alert('Sync Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const renderInstructionsTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Overview</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Students analyse breathing patterns at rest and after exercise.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Mobile phone with STEMM Lab app</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Flat surface or mat</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>
          1. Place the phone gently on your chest
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          2. Press Start and breathe normally — record breathing at rest
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          3. Perform light exercise (jog 1 minute on the spot OR 100 star jumps)
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          4. Press Start again and record breathing after exercise
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          5. Repeat exercise and record a second post-exercise reading
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          6. Rotate for each team member and compare results
        </Text>
      </View>
    </SectionCard>
  );

  const renderActivityTab = (): React.ReactElement => {
    const sessionLabel = SESSION_SHORT_LABELS[currentSessionIndex];
    const bpmWarning =
      lastSessionBpm != null &&
      (lastSessionBpm < BPM_WARNING_MIN || lastSessionBpm > BPM_WARNING_MAX);

    return (
      <View style={styles.activityWrap}>
        {!allSessionsComplete ? (
          <Text style={[styles.sessionIndicator, { color: text }]}>
            Session {currentSessionIndex + 1} of {SESSION_COUNT} — {sessionLabel}
          </Text>
        ) : null}

        {activityStep === 'exercise' ? (
          <SectionCard>
            <Text style={[styles.exerciseTitle, { color: text }]}>Time to exercise!</Text>
            <Text style={[styles.body, { color: mutedText }]}>
              Jog on the spot for 1 minute or do 100 star jumps. Press Ready when done.
            </Text>
            <PrimaryButton label="Ready" onPress={handleExerciseReady} style={{ marginTop: Spacing.sm }} />
          </SectionCard>
        ) : null}

        {activityStep === 'ready' || activityStep === 'recording' || activityStep === 'session_done' ? (
          <View style={styles.activityBlock}>
            <Text style={[styles.instruction, { color: mutedText }]}>
              Place phone flat on your chest and breathe normally
            </Text>

            <View style={[styles.indicatorCard, { borderColor: border, backgroundColor: card }]}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: zToBarHeight(liveZ),
                      backgroundColor: activityStep === 'recording' ? primary : border,
                    },
                  ]}
                />
              </View>

              {activityStep === 'recording' ? (
                <>
                  <Text style={[styles.recordingLabel, { color: primary }]}>Recording…</Text>
                  <Text style={[styles.countdown, { color: text }]}>{formatCountdown(countdownMs)}</Text>
                  <Text style={[styles.zValue, { color: mutedText }]}>Z: {liveZ.toFixed(2)}</Text>
                </>
              ) : activityStep === 'session_done' && lastSessionBpm != null ? (
                <>
                  <Text style={[styles.bpmResult, { color: text }]}>{lastSessionBpm} BPM</Text>
                  {bpmWarning ? (
                    <Text style={[styles.warning, { color: mutedText }]}>
                      Result may be inaccurate — ensure phone is flat on chest
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.zValue, { color: mutedText }]}>Z: {liveZ.toFixed(2)}</Text>
              )}
            </View>

            {activityStep === 'ready' ? (
              <PrimaryButton label="Start" onPress={startRecording} disabled={isSyncing} />
            ) : null}

            {activityStep === 'session_done' ? (
              <PrimaryButton
                label="Continue"
                variant="secondary"
                onPress={handleSessionContinue}
              />
            ) : null}
          </View>
        ) : null}

        {activityStep === 'summary' || allSessionsComplete ? (
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Session comparison</Text>
            <View style={[styles.summaryList, { borderTopColor: border }]}>
              <Text style={[styles.summaryRow, { color: mutedText }]}>
                At Rest: {restingBpm != null ? `${restingBpm} BPM` : '—'}
              </Text>
              <Text style={[styles.summaryRow, { color: mutedText }]}>
                After Exercise 1: {exercise1Bpm != null ? `${exercise1Bpm} BPM` : '—'}
              </Text>
              <Text style={[styles.summaryRow, { color: mutedText }]}>
                After Exercise 2: {exercise2Bpm != null ? `${exercise2Bpm} BPM` : '—'}
              </Text>
              <Text style={[styles.summaryRow, { color: mutedText }]}>
                Change from rest to exercise 1:{' '}
                {restingBpm != null && exercise1Bpm != null
                  ? `${exercise1Bpm - restingBpm > 0 ? '+' : ''}${exercise1Bpm - restingBpm} BPM`
                  : '—'}
              </Text>
              <Text style={[styles.summaryRow, { color: mutedText }]}>
                Change from rest to exercise 2:{' '}
                {restingBpm != null && exercise2Bpm != null
                  ? `${exercise2Bpm - restingBpm > 0 ? '+' : ''}${exercise2Bpm - restingBpm} BPM`
                  : '—'}
              </Text>
            </View>
            <PrimaryButton
              label={isSyncing ? 'Saving…' : 'Save Results'}
              onPress={() => void saveResults()}
              disabled={isSyncing || sessions.length < SESSION_COUNT}
              style={{ marginTop: Spacing.sm }}
            />
          </SectionCard>
        ) : null}
      </View>
    );
  };

  const renderDiscussionTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Breathing and Exercise</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Breathing rate increases during exercise to supply more oxygen to muscles and remove carbon
        dioxide. At rest, a healthy breathing rate is typically 12–20 breaths per minute. During or
        after vigorous exercise this can rise to 40 or more. Sensors in the phone detect the rise and
        fall of the chest, helping students visualise how the body responds to physical demand.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Curriculum links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Science (Biology): ACSSU176 — Body systems and physical activity
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Health: ACPPS054 — Physical activity and health
        </Text>
      </View>
    </SectionCard>
  );

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Breathing Pace Trainer</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Measure breaths per minute at rest and after exercise.
        </Text>
      </View>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isActive = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActive ? primary : card,
                  borderColor: isActive ? primary : border,
                },
              ]}>
              <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'instructions' ? renderInstructionsTab() : null}
      {screenTab === 'activity' ? renderActivityTab() : null}
      {screenTab === 'discussion' ? renderDiscussionTab() : null}

      <PrimaryButton
        label="Back to dashboard"
        variant="secondary"
        onPress={() => router.back()}
        disabled={isSyncing}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  tabPillText: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  activityWrap: { gap: Spacing.md },
  sessionIndicator: { ...Typography.section, textAlign: 'center' },
  activityBlock: { gap: Spacing.sm },
  instruction: { ...Typography.body, textAlign: 'center', fontWeight: '600' },
  indicatorCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 200,
    justifyContent: 'center',
  },
  barTrack: {
    width: 48,
    height: BAR_MAX_HEIGHT,
    borderRadius: Radius.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: Radius.md,
  },
  recordingLabel: { ...Typography.section, fontWeight: '700' },
  countdown: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  zValue: { ...Typography.body, fontVariant: ['tabular-nums'] },
  bpmResult: {
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  warning: { ...Typography.small, textAlign: 'center', lineHeight: 18 },
  exerciseTitle: { ...Typography.section, marginBottom: Spacing.xs },
  summaryList: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  summaryRow: { ...Typography.body, fontSize: 13 },
});
