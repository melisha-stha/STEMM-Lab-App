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
import { Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import type { BreathingSession as BaseBreathingSession } from '@/hooks/firestore';
import { uploadBreathingResult } from '@/hooks/firestore';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
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
const ACCELEROMETER_INTERVAL = 100;
const BAR_MAX_HEIGHT = 120;
const BAR_MIN_HEIGHT = 8;
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

type StepPanelProps = {
  step: number;
  title: string;
  colour?: ActivityCardColour;
  children: React.ReactNode;
};

function StepPanel({ step, title, colour = 'lavender', children }: StepPanelProps) {
  const { textColor, cardIconBg } = useActivityCardColours(colour);

  return (
    <ColorPanel colour={colour}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: cardIconBg }]}>
          <Text style={[styles.stepBadgeText, { color: textColor }]}>Step {step}</Text>
        </View>
        <Text style={[styles.stepTitle, { color: textColor }]}>{title}</Text>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </ColorPanel>
  );
}

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
    <Text style={[styles.heroTitle, { color: textColor, fontFamily: pixelFamily }]}>
      Breathing Pace Trainer
    </Text>
  );
}

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
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useBreathingScreenBackground();

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
    <View style={[styles.root, { backgroundColor: background }]}>
      <BreathingScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}>
            {SCREEN_TABS.map((tab) => {
              const isActiveTab = screenTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setScreenTab(tab)}
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
                  onPress={() => setScreenTab('activity')}
                  style={[
                    styles.heroCta,
                    {
                      backgroundColor: primary,
                      borderColor: primary,
                      borderBottomColor: primaryDark,
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.heroCtaText,
                      {
                        color: onPrimary,
                        textAlign: 'center',
                        fontFamily: pixelFontLoaded ? pixelFamily : undefined,
                      },
                    ]}>
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

          <StepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Set up participant">
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
          </StepPanel>

          <StepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Measure breathing rate">
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
                  Place phone flat on your chest and breathe normally
                </PanelMuted>

                <View style={[styles.indicatorCard, { borderColor: border, backgroundColor: backgroundSecondary }]}>
                  <View style={[styles.barTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
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
          </StepPanel>

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
            <PrimaryButton
              label="Back to dashboard"
              variant="secondary"
              onPress={() => router.back()}
              disabled={isSyncing}
              style={{ marginTop: Spacing.sm }}
            />
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
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
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
  exerciseTitle: { fontSize: 16, fontWeight: '900' },
  summaryRow: { fontSize: 13, paddingVertical: 2, opacity: 0.95 },
  attemptRowListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  exerciseAlertCard: { padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dotted', marginVertical: Spacing.xs },
  body: { fontSize: 13 },
});