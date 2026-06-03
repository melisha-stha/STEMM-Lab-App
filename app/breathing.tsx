import { ActivityStepPanel } from '@/components/activity/ActivityStepPanel';
import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelTitle,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import {
  BreathingScreenBackground,
  useBreathingScreenBackground,
} from '@/components/ui/breathing-screen-background';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { formatCountdownSeconds, formatDuration } from '@/utils/formatters/duration';
import { insertTrial } from '@/hooks/database';
import type { BreathingSession as BaseBreathingSession } from '@/hooks/firestore';
import { uploadBreathingResult } from '@/hooks/firestore';
import { scheduleAppNotification } from '@/hooks/notifications';
import { androidPixelPressableBox, usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useBatteryTracker } from '@/hooks/useBatteryTracker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

const ACTIVITY_BREATHING = 'breathing';
const SESSION_COUNT = 3;
const SESSION_DURATION_MS = 30000; // 30-second measurement window
const ACCELEROMETER_INTERVAL = 50; // 20 Hz — better resolution for slow chest motion
const BAR_MAX_HEIGHT = 120;
const BAR_MIN_HEIGHT = 8;
const MIN_SAMPLES_FOR_BPM = 40;
const BREATHING_DIAGRAM = require('@/assets/images/breathing-diagram.jpeg');
const BREATHING_DIAGRAM_ASPECT = 680 / 382;

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

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = ['lavender', 'sky', 'lavender'];

function BreathingDiagramFrame() {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.diagramWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={BREATHING_DIAGRAM}
        style={styles.diagramImage}
        contentFit="contain"
        accessibilityLabel="Diagram showing phone placement on chest for breathing pace trainer"
      />
    </View>
  );
}

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Breathing Pace Trainer
    </Text>
  );
}

type AccelSample = { x: number; y: number; z: number };

/** Total g from x/y/z — works regardless of how the phone rests on the chest. */
const getChestMotionMagnitude = (x: number, y: number, z: number): number =>
  Math.sqrt(x * x + y * y + z * z);

/** Chest motion strength for the live bar (0–1 scale). */
const getMotionStrength = (x: number, y: number, z: number): number => {
  const magnitude = getChestMotionMagnitude(x, y, z);
  return Math.min(1, Math.abs(magnitude - 1.0) * 12);
};

const smoothSeries = (values: number[], windowSize: number): number[] => {
  const smoothed: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize);
    const subset = values.slice(start, i + 1);
    smoothed.push(subset.reduce((sum, v) => sum + v, 0) / subset.length);
  }
  return smoothed;
};

const estimateBpmFromSeries = (values: number[], durationSec: number): number => {
  if (values.length < MIN_SAMPLES_FOR_BPM || durationSec <= 0) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const centered = values.map((v) => v - mean);
  const smoothed = smoothSeries(centered, 5);

  const peakAmplitude = smoothed.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
  if (peakAmplitude < 0.002) return 0;

  const threshold = peakAmplitude * 0.2;
  let peaks = 0;
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1] &&
      Math.abs(smoothed[i]) > threshold
    ) {
      peaks++;
    }
  }

  if (peaks === 0) return 0;

  const breathCycles = Math.max(1, Math.round(peaks * 0.65));
  const bpm = Math.round((breathCycles / durationSec) * 60);
  return Math.max(6, Math.min(80, bpm));
};

const calculateBPM = (samples: AccelSample[]): number => {
  if (samples.length < MIN_SAMPLES_FOR_BPM) return 0;

  const durationSec = (samples.length * ACCELEROMETER_INTERVAL) / 1000;
  const xValues = samples.map((s) => s.x);
  const yValues = samples.map((s) => s.y);
  const zValues = samples.map((s) => s.z);
  const magnitudeValues = samples.map((s) => getChestMotionMagnitude(s.x, s.y, s.z));

  const candidates = [
    estimateBpmFromSeries(xValues, durationSec),
    estimateBpmFromSeries(yValues, durationSec),
    estimateBpmFromSeries(zValues, durationSec),
    estimateBpmFromSeries(magnitudeValues, durationSec),
  ].filter((bpm) => bpm > 0);

  if (candidates.length === 0) return 0;

  candidates.sort((a, b) => a - b);
  return candidates[Math.floor(candidates.length / 2)];
};

export default function BreathingScreen() {
  const router = useRouter();
  const { getOptimizedLocation } = useBatteryTracker();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useBreathingScreenBackground();

  const scrollRef = useRef<ScrollView>(null);

  const [screenTab, setScreenTab] = useState<ScreenTab>('instructions');
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [activityStep, setActivityStep] = useState<ActivityStep>('ready');
  const [countdownMs, setCountdownMs] = useState(SESSION_DURATION_MS);
  const [liveMotionStrength, setLiveMotionStrength] = useState(0);
  const [liveSampleCount, setLiveSampleCount] = useState(0);
  const [liveBpmEstimate, setLiveBpmEstimate] = useState<number | null>(null);
  const [sensorReady, setSensorReady] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [memberName, setMemberName] = useState('');
  const [attempts, setAttempts] = useState<ExtendedBreathingAttempt[]>([]);

  const motionSamples = useRef<AccelSample[]>([]);
  const accelSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const recordingSessionRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary' as any) ?? useThemeColor({}, 'mutedText');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const onPrimary = useThemeColor({}, 'onPrimary' as any) ?? '#FFFFFF';

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearChallengeInterval = useCallback(() => {
    if (challengeIntervalRef.current) clearInterval(challengeIntervalRef.current);
    challengeIntervalRef.current = null;
  }, []);

  const runChallengeInterval = useCallback(() => {
    clearChallengeInterval();
    const endAt = Date.now() + challengeRemainingMs;
    challengeIntervalRef.current = setInterval(() => {
      const next = Math.max(0, endAt - Date.now());
      setChallengeRemainingMs(next);
      if (next <= 0) {
        clearChallengeInterval();
        setChallengeTimerRunning(false);
        setChallengeTimerFinished(true);
      }
    }, 250);
  }, [challengeRemainingMs, clearChallengeInterval]);

  const startChallengeTimer = useCallback(() => {
    if (challengeTimerFinished || challengeTimerRunning) return;
    setChallengeTimerStarted(true);
    setChallengeTimerRunning(true);
    runChallengeInterval();
  }, [challengeTimerFinished, challengeTimerRunning, runChallengeInterval]);

  const scrollToTop = useCallback((animated = true) => {
    scrollRef.current?.scrollTo({ y: 0, animated });
  }, []);

  const pauseChallengeTimer = useCallback(() => {
    if (!challengeTimerRunning) return;
    clearChallengeInterval();
    setChallengeTimerRunning(false);
  }, [challengeTimerRunning, clearChallengeInterval]);

  const resumeChallengeTimer = useCallback(() => {
    if (challengeTimerFinished || challengeTimerRunning || challengeRemainingMs <= 0) return;
    setChallengeTimerStarted(true);
    setChallengeTimerRunning(true);
    runChallengeInterval();
  }, [challengeRemainingMs, challengeTimerFinished, challengeTimerRunning, runChallengeInterval]);

  const stopChallengeTimer = useCallback(() => {
    clearChallengeInterval();
    setChallengeTimerStarted(false);
    setChallengeTimerRunning(false);
    setChallengeTimerFinished(true);
    setChallengeRemainingMs(0);
  }, [clearChallengeInterval]);

  useEffect(() => () => clearChallengeInterval(), [clearChallengeInterval]);

  const liveBarHeight = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, liveMotionStrength));
    return BAR_MIN_HEIGHT + clamped * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
  }, [liveMotionStrength]);

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

  const handleAccelSample = useCallback((x: number, y: number, z: number, record: boolean) => {
    const sample = { x, y, z };
    setLiveMotionStrength(getMotionStrength(x, y, z));

    if (!record) return;

    motionSamples.current.push(sample);
    const count = motionSamples.current.length;
    setLiveSampleCount(count);
    if (count >= MIN_SAMPLES_FOR_BPM) {
      setLiveBpmEstimate(calculateBPM(motionSamples.current));
    }
  }, []);

  const finishRecording = (): void => {
    recordingSessionRef.current = false;
    stopAccelerometer();
    clearRecordingTimers();
    setLiveBpmEstimate(null);

    const bpm = calculateBPM(motionSamples.current);
    const label = SESSION_LABELS[currentSessionIndex];
    const currentName = memberName.trim();

    if (bpm <= 0) {
      setActivityStep('ready');
      Alert.alert(
        'Could not detect breathing',
        'Keep the phone flat on your chest and breathe steadily, then try the 30s recording again.'
      );
      return;
    }

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

  const startRecording = async (): Promise<void> => {
    if (!memberName.trim()) {
      Alert.alert('Name Required', 'Please input a student name to track your session details.');
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Sensor unavailable', 'Accelerometer is not available on web.');
      return;
    }

    const available = await Accelerometer.isAvailableAsync();
    if (!available) {
      Alert.alert('Sensor unavailable', 'This device does not have an accelerometer.');
      return;
    }

    stopAccelerometer();
    recordingSessionRef.current = true;
    motionSamples.current = [];
    setCountdownMs(SESSION_DURATION_MS);
    setLiveBpmEstimate(null);
    setLiveSampleCount(0);

    Accelerometer.setUpdateInterval(ACCELEROMETER_INTERVAL);
    accelSubscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
      handleAccelSample(x, y, z, true);
    });

    setActivityStep('recording');

    countdownIntervalRef.current = setInterval(() => {
      setCountdownMs((prev) => Math.max(0, prev - ACCELEROMETER_INTERVAL));
    }, ACCELEROMETER_INTERVAL);

    recordingStopRef.current = setTimeout(() => {
      finishRecording();
    }, SESSION_DURATION_MS);
  };

  useEffect(() => {
    if (Platform.OS === 'web' || screenTab !== 'activity') {
      setSensorReady(false);
      return;
    }

    let cancelled = false;
    void Accelerometer.isAvailableAsync().then((available) => {
      if (!cancelled) setSensorReady(available);
    });

    return () => {
      cancelled = true;
    };
  }, [screenTab]);

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      screenTab !== 'activity' ||
      activityStep !== 'ready' ||
      !memberName.trim()
    ) {
      return;
    }

    let active = true;
    void (async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (!available || !active) return;

      Accelerometer.setUpdateInterval(ACCELEROMETER_INTERVAL);
      accelSubscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
        handleAccelSample(x, y, z, false);
      });
    })();

    return () => {
      active = false;
      if (!recordingSessionRef.current) {
        stopAccelerometer();
      }
    };
  }, [screenTab, activityStep, memberName, handleAccelSample]);

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
    setLiveMotionStrength(0);
    setLiveSampleCount(0);
    setLiveBpmEstimate(null);
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
        locationData = await getOptimizedLocation();
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

      const elapsedMs = EXPERIMENT_CHALLENGE_LIMIT_MS - challengeRemainingMs;
      const timeSummary =
        challengeTimerStarted && elapsedMs >= 0
          ? `Time taken: ${formatDuration(elapsedMs)}`
          : `Time taken: —`;

      stopChallengeTimer();

      await scheduleAppNotification({
        title: 'STEMM Lab Sync Complete',
        body: 'Breathing result saved',
        data: { screen: 'breathing-results' },
      });

      Alert.alert(
        'Upload Successful', 
        `Your team session updates were safely sent to the cloud database dashboard.\n\n${timeSummary}`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.push({
                pathname: '/breathing-results',
                params: { sessionsJson: JSON.stringify(formattedPayload) },
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Breathing save error:', error);
      Alert.alert('Sync Error', 'Could not establish connection with database storage pipelines.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <BreathingScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <ScreenBackButton />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}>
            {SCREEN_TABS.map((tab) => {
              const isActiveTab = screenTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => {
                    setScreenTab(tab);
                    requestAnimationFrame(() => scrollToTop(true));
                  }}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: isActiveTab ? primary : primarySoft,
                      borderColor: isActiveTab ? primary : border,
                    },
                  ]}>
                  <Text style={[styles.tabPillText, { color: isActiveTab ? onPrimary : primary }]}>
                    {SCREEN_TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ==================== TAB 1: INSTRUCTIONS ==================== */}
          {screenTab === 'instructions' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                {pixelFontLoaded ? <OverviewHeroTitle pixelFamily={pixelFamily} /> : <PanelTitle>Breathing Pace Trainer</PanelTitle>}
            <PanelMuted style={styles.heroSubtitle}>Biology · Physical Activity</PanelMuted>
            <PanelMuted style={styles.heroBody}>
              Students analyse chest expansion breathing frequency shifts at rest and after intense aerobic exercise routines.
            </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="yellow">
                <PanelTitle>How to conduct</PanelTitle>
                <PanelMuted style={styles.bodyMuted}>Instructions Layout</PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  1. Enter your participant identity label inside the field box bounds.
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  2. Lie down flat, rest the phone directly over your chest center plate, and tap start.
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  3. Run through all three distinct resting and post-exercise challenge sequences sequentially.
                </PanelMuted>
                <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>Placement diagram</PanelMuted>
                <BreathingDiagramFrame />
              </ColorPanel>

              <View style={styles.overviewActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setScreenTab('activity');
                    requestAnimationFrame(() => scrollToTop(true));
                  }}
                  style={[
                    styles.heroCta,
                    androidPixelPressableBox(),
                    {
                      backgroundColor: primary,
                      borderColor: primary,
                      borderBottomColor: primaryDark,
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                    },
                  ]}>
                  <Text
                    style={withPixelFontStyle(
                      pixelFontLoaded ? pixelFamily : undefined,
                      styles.heroCtaText,
                      { color: onPrimary, textAlign: 'center' }
                    )}>
                    ▶  Start activity
                  </Text>
                </Pressable>
                <PrimaryButton
                  label="Back to dashboard"
                  variant="secondary"
                  onPress={() => router.back()}
                  disabled={isSyncing}
                />
              </View>
            </View>
          )}

      {/* ==================== TAB 2: ACTIVE DIAGNOSTICS ==================== */}
      {screenTab === 'activity' && (
        <View style={styles.tabContent}>
          <ColorPanel colour="mint">
            <ExperimentChallengeTimer
              pixelFamily={pixelFontLoaded ? pixelFamily : undefined}
              started={challengeTimerStarted}
              running={challengeTimerRunning}
              finished={challengeTimerFinished}
              remainingMs={challengeRemainingMs}
              onStart={startChallengeTimer}
              onPause={pauseChallengeTimer}
              onResume={resumeChallengeTimer}
              onStop={stopChallengeTimer}
            />
          </ColorPanel>

          <ActivityStepPanel variant="inline" step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Set up participant">
            <Input
              label="Participant student name"
              placeholder="Enter active name..."
              value={memberName}
              onChangeText={setMemberName}
              editable={activityStep === 'ready' || activityStep === 'summary'}
            />

            {activityStep !== 'summary' && memberName.trim().length > 0 && (
              <Text style={[styles.sessionIndicator, { color: text }]}>
                Session {currentSessionIndex + 1} of {SESSION_COUNT} — {SESSION_SHORT_LABELS[currentSessionIndex]}
              </Text>
            )}
          </ActivityStepPanel>

          <ActivityStepPanel variant="inline" step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Measure breathing rate">
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
                <PanelMuted style={[styles.instruction, { color: textSecondary }]}>
                  Place phone flat on your chest and breathe normally. The bar moves with your chest —
                  measured by the device accelerometer.
                </PanelMuted>

                {sensorReady === false && (
                  <PanelMuted style={[styles.sensorHint, { color: mutedText }]}>
                    Accelerometer not available on this device.
                  </PanelMuted>
                )}

                <View style={[styles.indicatorCard, { borderColor: border, backgroundColor: backgroundSecondary }]}>
                  <View style={[styles.barTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: liveBarHeight,
                          backgroundColor:
                            activityStep === 'recording' ? primary : sensorReady ? border : mutedText,
                        },
                      ]}
                    />
                  </View>

                  {activityStep === 'recording' && (
                    <>
                      <Text style={[styles.recordingLabel, { color: primary }]}>LOGGING CHEST MOTION…</Text>
                      <Text style={[styles.countdown, { color: text }]}>{formatCountdownSeconds(countdownMs)}</Text>
                      <Text style={[styles.liveBpm, { color: textSecondary }]}>
                        Live estimate: {liveBpmEstimate != null ? `${liveBpmEstimate} BPM` : '…'}
                      </Text>
                      <Text style={[styles.liveBpm, { color: mutedText }]}>
                        Motion: {Math.round(liveMotionStrength * 100)}% · {liveSampleCount} samples
                      </Text>
                    </>
                  )}

                  {activityStep === 'ready' && sensorReady && memberName.trim().length > 0 && (
                    <Text style={[styles.liveBpm, { color: textSecondary }]}>
                      Sensor active — motion {Math.round(liveMotionStrength * 100)}% (bar should move
                      as you breathe)
                    </Text>
                  )}

                  {activityStep === 'session_done' && (
                    <Text style={[styles.bpmResult, { color: primary }]}>
                      {currentMemberAttempts.find((a) => a.sessionIndex === currentSessionIndex)?.bpm ?? '—'} BPM
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
          </ActivityStepPanel>

            {/* Individual Participant Run Summary Breakdown Views */}
            {(activityStep === 'summary' || currentMemberAttempts.length === SESSION_COUNT) && (
              <ColorPanel colour="lavender">
                <PanelTitle>{memberName.trim()}&apos;s session comparison</PanelTitle>
                <PanelMuted style={styles.summaryRow}>
                  At Rest: {restingBpm != null ? `${restingBpm} BPM` : '—'}
                </PanelMuted>
                <PanelMuted style={styles.summaryRow}>
                  After Exercise 1: {exercise1Bpm != null ? `${exercise1Bpm} BPM` : '—'}
                </PanelMuted>
                <PanelMuted style={styles.summaryRow}>
                  After Exercise 2: {exercise2Bpm != null ? `${exercise2Bpm} BPM` : '—'}
                </PanelMuted>
                <PanelMuted style={[styles.summaryRow, { fontWeight: '700', color: primary } as any]}>
                  Delta Shift (Rest → Ex 1):{' '}
                  {restingBpm != null && exercise1Bpm != null ? `${exercise1Bpm - restingBpm} BPM Increase` : '—'}
                </PanelMuted>

                <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                  <PrimaryButton
                    label={isSyncing ? 'Uploading...' : 'Save Member Results'}
                    onPress={saveResults}
                    disabled={isSyncing || currentMemberAttempts.length < SESSION_COUNT}
                  />
                  <PrimaryButton
                    label="Next Team Member Setup"
                    variant="secondary"
                    onPress={resetForNextMemberSetup}
                    style={{ borderStyle: 'dashed', borderColor: primary }}
                  />
                </View>
              </ColorPanel>
            )}

          <ColorPanel colour="sky">
            <PanelTitle>Team progress log</PanelTitle>
            {attempts.length === 0 ? (
              <PanelMuted>No local participant records populated in this cycle yet.</PanelMuted>
            ) : (
              attempts.map((item, index) => (
                <View key={`${item.memberName}-${item.sessionIndex}-${index}`} style={[styles.attemptRowListItem, { borderBottomColor: border }]}>
                  <Text style={[styles.body, { color: text, fontWeight: '700' }]}>{item.memberName}</Text>
                  <Text style={[styles.body, { color: textSecondary }]}>
                    {SESSION_SHORT_LABELS[item.sessionIndex]}: {item.bpm} BPM
                  </Text>
                </View>
              ))
            )}
          </ColorPanel>
        </View>
      )}

      {/* ==================== TAB 3: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <View style={styles.tabContent}>
          <ColorPanel colour="sky">
            <PanelTitle>Biology system insights</PanelTitle>
            <PanelMuted style={styles.bodyMuted}>
              Breathing frequencies ramp up dynamically alongside exertion loads to fast-track oxygen cellular transmission into fatigued skeletal muscle fibers. Lying completely supine aligns the phone along structural gravity bounds, transforming the underlying accelerometer into an precise physical chest tracking device.
            </PanelMuted>
          </ColorPanel>
        </View>
      )}

          {screenTab !== 'instructions' && (
            <>
              {screenTab === 'activity' ? (
                <PrimaryButton
                  label="Go to discussion"
                  variant="secondary"
                  onPress={() => {
                    setScreenTab('discussion');
                    requestAnimationFrame(() => scrollToTop(true));
                  }}
                  disabled={isSyncing}
                  style={{ marginTop: Spacing.sm }}
                />
              ) : null}
              <PrimaryButton
                label="Back to dashboard"
                variant="secondary"
                onPress={() => router.back()}
                disabled={isSyncing}
                style={{ marginTop: Spacing.sm }}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: SCREEN_BOTTOM_INSET + Spacing.xl,
  },
  tabRow: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: { fontSize: 12, fontWeight: '800' },
  tabContent: { gap: Spacing.md },

  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  heroSubtitle: { marginTop: Spacing.xs, fontSize: 12, opacity: 0.85 },
  heroBody: { marginTop: Spacing.sm, fontSize: 13, lineHeight: 18, opacity: 0.85 },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
  },
  heroCtaText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  overviewActions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  bodyMuted: { fontSize: 13, lineHeight: 19, opacity: 0.88 },
  bulletPrompt: { fontSize: 13, lineHeight: 19, opacity: 0.88, marginTop: 6 },
  diagramWrap: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: Spacing.sm,
  },
  diagramImage: {
    width: '100%',
    aspectRatio: BREATHING_DIAGRAM_ASPECT,
  },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  stepBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  stepTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  stepBody: { gap: Spacing.sm },

  sessionIndicator: { textAlign: 'center', marginTop: Spacing.xs, fontWeight: '800' },
  activityBlock: { gap: Spacing.sm },
  instruction: { textAlign: 'center', fontWeight: '700', marginBottom: 4 },
  indicatorCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 200,
    justifyContent: 'center',
  },
  barTrack: { width: 40, height: BAR_MAX_HEIGHT, borderRadius: Radius.md, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: Radius.md },
  recordingLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  countdown: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bpmResult: { fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  liveBpm: { fontSize: 15, fontWeight: '600', marginTop: Spacing.xs, textAlign: 'center' },
  sensorHint: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.sm },
  exerciseTitle: { fontSize: 16, fontWeight: '900' },
  summaryRow: { fontSize: 13, paddingVertical: 2, opacity: 0.95 },
  attemptRowListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  exerciseAlertCard: { padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dotted', marginVertical: Spacing.xs },
  body: { fontSize: 13 },
});