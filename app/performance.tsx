import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelTitle,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import { AttemptRow } from '@/components/ui/attempt-row';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { Input } from '@/components/ui/input';
import {
  PerformanceScreenBackground,
  usePerformanceScreenBackground,
} from '@/components/ui/performance-screen-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { androidPixelPressableBox, usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useBatteryTracker } from '@/hooks/useBatteryTracker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { scheduleAppNotification } from '@/hooks/notifications';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { uploadPerformanceResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';


export const options = {
  headerShown: false,
};

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

const MOVEMENT_IMAGES = [
  require('@/assets/images/movement-1.jpeg'),
  require('@/assets/images/movement-2.jpeg'),
  require('@/assets/images/movement-3.jpeg'),
] as const;

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const EQUIPMENT_ITEMS = ['Mobile phone with STEMM Lab app', 'Open space to move safely'] as const;

const MOVEMENT_DURATION_MS = 30000;
const SENSOR_INTERVAL_MS = 100;

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

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Human Performance Lab
    </Text>
  );
}

function MovementImageFrame({ index }: { index: 0 | 1 | 2 }) {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.diagramWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={MOVEMENT_IMAGES[index]}
        style={styles.diagramImage}
        contentFit="contain"
        accessibilityLabel={`Movement ${index + 1} diagram`}
      />
    </View>
  );
}

function OverviewEquipmentChecklist() {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const success = useThemeColor({}, 'success');
  const error = useThemeColor({}, 'error');

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EQUIPMENT_ITEMS.map((item) => [item, false]))
  );

  const missingItems = EQUIPMENT_ITEMS.filter((item) => !checked[item]);
  const allGathered = missingItems.length === 0;
  const hasStartedSelecting = EQUIPMENT_ITEMS.some((item) => checked[item]);

  const toggleEquipment = (item: string) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  return (
    <>
      <PanelMuted style={styles.bodyMuted}>Select all equipment you have gathered</PanelMuted>

      <View style={styles.equipmentChecklist}>
        {EQUIPMENT_ITEMS.map((item) => {
          const isChecked = checked[item];
          return (
            <Pressable
              key={item}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={item}
              onPress={() => toggleEquipment(item)}
              style={[
                styles.equipmentRow,
                {
                  borderColor: isChecked ? success : borderColor,
                  backgroundColor: cardIconBg,
                },
              ]}>
              <MaterialIcons
                name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color={isChecked ? success : borderColor}
              />
              <Text
                style={[
                  styles.equipmentText,
                  { color: textColor, fontWeight: isChecked ? '700' : '600' },
                ]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {allGathered ? (
        <View style={[styles.equipmentStatusBanner, { backgroundColor: cardIconBg, borderColor: success }]}>
          <MaterialIcons name="celebration" size={20} color={success} />
          <Text style={[styles.equipmentStatusText, { color: success }]}>You&apos;re good to go!</Text>
        </View>
      ) : hasStartedSelecting ? (
        <View style={[styles.equipmentStatusBanner, { backgroundColor: cardIconBg, borderColor: error }]}>
          <MaterialIcons name="warning" size={20} color={error} />
          <View style={styles.missingEquipmentBlock}>
            <Text style={[styles.equipmentStatusText, { color: error }]}>Missing equipment:</Text>
            {missingItems.map((m) => (
              <Text key={m} style={[styles.missingEquipmentItem, { color: error }]}>
                • {m}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}


type Attempt = {
  memberName: string;
  movement: string;
  peakForce: number;
  averageForce: number;
  durationSec: number;
};

export default function PerformanceScreen() {
  const router = useRouter();
  const { getOptimizedLocation } = useBatteryTracker();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = usePerformanceScreenBackground();

  const scrollRef = useRef<ScrollView>(null);

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentMovementIndex, setCurrentMovementIndex] = useState(0);
  const [liveForce, setLiveForce] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [locationStatus, setLocationStatus] = useState('Searching...');
  const [memberName, setMemberName] = useState('');
  const [timeLeftMs, setTimeLeftMs] = useState(MOVEMENT_DURATION_MS);

  const subscriptionRef = useRef<any>(null);
  const peakForceRef = useRef(0);
  const forceReadingsRef = useRef<number[]>([]);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary' as any) ?? useThemeColor({}, 'mutedText');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary');
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

  const scrollToTop = useCallback((animated = true) => {
    scrollRef.current?.scrollTo({ y: 0, animated });
  }, []);

  useEffect(() => () => clearChallengeInterval(), [clearChallengeInterval]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
    return () => {
      stopSensor();
      clearCountdown();
    };
  }, []);

  const filteredAttempts = useMemo(() => {
    return attempts.filter(a => a.memberName === memberName.trim());
  }, [attempts, memberName]);

  const allDone = filteredAttempts.length >= MOVEMENTS.length;

  const getScoreLabel = (avg: number): { label: string; color: string } => {
    if (avg < 0.15) return { label: 'Excellent — Very smooth', color: '#4CAF50' };
    if (avg < 0.35) return { label: 'Good — Moderate control', color: '#FF9800' };
    return { label: 'Needs practice — Shaky movement', color: '#FF4444' };
  };

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startSensor = () => {
    if (!memberName.trim()) {
      Alert.alert('Name Required', 'Please enter a participant name before starting.');
      return;
    }
    if (Platform.OS === 'web') return;

    peakForceRef.current = 0;
    forceReadingsRef.current = [];
    setTimeLeftMs(MOVEMENT_DURATION_MS);
    setIsActive(true);

    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    subscriptionRef.current = Accelerometer.addListener(data => {
      const rawMagnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      const relativeDeviation = Math.abs(rawMagnitude - 1.0);
      
      setLiveForce(relativeDeviation);
      if (relativeDeviation > peakForceRef.current) peakForceRef.current = relativeDeviation;
      forceReadingsRef.current.push(relativeDeviation);
    });

    countdownIntervalRef.current = setInterval(() => {
      setTimeLeftMs(prev => {
        const nextTime = prev - SENSOR_INTERVAL_MS;
        if (nextTime <= 0) {
          clearCountdown();
          setTimeout(() => {
            stopAndRecord();
          }, 0);
          return 0;
        }
        return nextTime;
      });
    }, SENSOR_INTERVAL_MS);
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
    clearCountdown();
    
    const readings = forceReadingsRef.current;
    if (readings.length === 0) return;

    const avgForce = readings.reduce((a, b) => a + b, 0) / readings.length;
    const durationUsed = (MOVEMENT_DURATION_MS - timeLeftMs) / 1000;
    const movement = MOVEMENTS[currentMovementIndex];
    const currentName = memberName.trim();

    const newAttempt: Attempt = {
      memberName: currentName,
      movement: movement.label,
      peakForce: Math.round(peakForceRef.current * 100) / 100,
      averageForce: Math.round(avgForce * 100) / 100,
      durationSec: Math.round(durationUsed * 10) / 10,
    };

    setAttempts(prev => [
      ...prev.filter(a => !(a.memberName === currentName && a.movement === movement.label)),
      newAttempt,
    ]);
    setLiveForce(0);
    setTimeLeftMs(MOVEMENT_DURATION_MS);

    if (currentMovementIndex < MOVEMENTS.length - 1) {
      setCurrentMovementIndex(prev => prev + 1);
    }
  };

  const resetAll = () => {
    stopSensor();
    clearCountdown();
    const currentName = memberName.trim();
    setAttempts(prev => prev.filter(a => a.memberName !== currentName));
    setCurrentMovementIndex(0);
    setLiveForce(0);
    setTimeLeftMs(MOVEMENT_DURATION_MS);
  };

  const prepNextTeamMember = () => {
    stopSensor();
    clearCountdown();
    setCurrentMovementIndex(0);
    setLiveForce(0);
    setMemberName('');
    setTimeLeftMs(MOVEMENT_DURATION_MS);
  };

  const handleSave = async () => {
    if (!filteredAttempts.length) return;
    const user = auth.currentUser;
    if (!user) return;
    setIsSyncing(true);
    try {
      let locationData = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationData = await getOptimizedLocation();
      }
      const teamData = await getTeamData();
      const bestAvg = Math.min(...filteredAttempts.map(a => a.averageForce));

      await Promise.all([
        uploadPerformanceResult(user.uid, teamData, filteredAttempts, locationData),
        Promise.resolve(insertTrial(
          teamData?.name || 'unknown',
          'performance',
          Math.round(bestAvg * 1000),
          '',
          locationData?.latitude || null,
          locationData?.longitude || null
        ))
      ]);

      const elapsedMs = EXPERIMENT_CHALLENGE_LIMIT_MS - challengeRemainingMs;
      const timeSummary =
        challengeTimerStarted && elapsedMs >= 0
          ? `Time taken: ${formatDuration(elapsedMs)}`
          : `Time taken: —`;

      stopChallengeTimer();

      await scheduleAppNotification({
        title: 'STEMM Lab Sync Complete',
        body: `Performance results for ${teamData?.name || 'your team'} have been saved! ${timeSummary}`,
        data: { screen: 'performance-results' },
      });

      Alert.alert('Saved!', `Your performance results have been saved.\n\n${timeSummary}`, [
        {
          text: 'OK',
          onPress: () => {
            router.push({
              pathname: '/performance-results' as any,
              params: { attemptsJson: JSON.stringify(filteredAttempts) },
            });
          }
        }
      ]);
    } catch (error) {
      console.error('Performance Save Error:', error);
      Alert.alert('Save Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const timeBarWidthPercent = `${Math.max(0, Math.min(100, (timeLeftMs / MOVEMENT_DURATION_MS) * 100))}%`;

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      <ColorPanel colour="lavender">
        {pixelFontLoaded ? (
          <OverviewHeroTitle pixelFamily={pixelFamily} />
        ) : (
          <PanelTitle>Human Performance Lab</PanelTitle>
        )}
        <PanelMuted style={styles.heroSubtitle}>Medical Science · Biomechanics</PanelMuted>
        <PanelMuted style={styles.heroBody}>
          Students investigate how the human body moves by measuring speed, smoothness, and coordination during controlled stretching activities. The phone&apos;s accelerometer measures how gracefully you move — the lower the reading, the smoother the movement.
        </PanelMuted>
      </ColorPanel>

      <ColorPanel colour="yellow">
        <PanelTitle>Equipment checklist</PanelTitle>
        <OverviewEquipmentChecklist />
      </ColorPanel>

      <ColorPanel colour="sky">
        <PanelTitle>Step-by-step</PanelTitle>
        {[
          'Hold the phone firmly in one hand.',
          'Press Start on the Experiment tab.',
          'Perform the guided movement as slowly and smoothly as possible for 30 seconds.',
          'The app automatically stops and records your score at the end of the countdown.',
          'Complete all 3 movements and compare results.',
          'Save and reflect as a group.',
        ].map((step, i) => (
          <PanelMuted key={step} style={styles.bulletPrompt}>
            {i + 1}. {step}
          </PanelMuted>
        ))}

        <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>The 3 movements</PanelMuted>
        {MOVEMENTS.map((m, i) => (
          <View key={m.label} style={{ marginTop: Spacing.sm }}>
            <Text style={[styles.movementLabel, { color: primary }]}>{m.label}</Text>
            <PanelMuted style={styles.bodyMuted}>{m.description}</PanelMuted>
            <MovementImageFrame index={i as 0 | 1 | 2} />
          </View>
        ))}
      </ColorPanel>

      <View style={styles.overviewActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setScreenTab('experiment');
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
            ▶  Start experiment
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
  );

  const renderExperimentTab = () => {
    const currentMovement = MOVEMENTS[currentMovementIndex];
    const score = getScoreLabel(liveForce);

    return (
      <>
        <StepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Set up participant">
          <Input
            label="Participant student name"
            placeholder="Enter student name..."
            value={memberName}
            onChangeText={setMemberName}
            editable={!isActive}
          />
          <PanelMuted style={styles.bodyMuted}>GPS Status: {locationStatus}</PanelMuted>
          {memberName.trim().length > 0 ? (
            <PanelMuted style={styles.bodyMuted}>
              Attempts recorded for {memberName.trim()}: {filteredAttempts.length}/{MOVEMENTS.length}
            </PanelMuted>
          ) : null}
        </StepPanel>

        {!allDone && memberName.trim().length > 0 ? (
          <StepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title={currentMovement.label}>
            <PanelMuted style={styles.bodyMuted}>{currentMovement.description}</PanelMuted>

            {isActive ? (
              <View style={styles.timerTrackField}>
                <View style={[styles.timerProgressBarFill, { width: timeBarWidthPercent as any, backgroundColor: primary }]} />
                <Text style={styles.timerPercentageText}>Time Remaining: {Math.ceil(timeLeftMs / 1000)}s</Text>
              </View>
            ) : null}

            <PanelMuted style={styles.fieldLabel}>Live sensor reading</PanelMuted>
            <Text style={[styles.liveForce, { color: isActive ? score.color : textSecondary }]}>
              {liveForce.toFixed(2)} g
            </Text>
            {isActive ? <PanelMuted style={[styles.bodyMuted, { color: score.color }]}>{score.label}</PanelMuted> : null}

            <View style={styles.buttonRow}>
              <PrimaryButton
                label={isActive ? 'Stop' : 'Start'}
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
                disabled={isSyncing || (filteredAttempts.length === 0 && !isActive)}
                style={{ flex: 1 }}
              />
            </View>
          </StepPanel>
        ) : null}

        <StepPanel step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Your results">
          {filteredAttempts.length > 0 ? (
            <View style={styles.attemptsWrap}>
              {filteredAttempts.map((a, i) => (
                <AttemptRow
                  key={`${a.movement}-${i}`}
                  index={i + 1}
                  title={a.movement}
                  subtitle={`Avg ${a.averageForce} g · Peak ${a.peakForce} g · ${a.durationSec}s`}
                  isLast={i === filteredAttempts.length - 1}
                />
              ))}
            </View>
          ) : (
            <PanelMuted>No attempts recorded yet.</PanelMuted>
          )}

          {allDone ? (
            <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              <PrimaryButton
                label={isSyncing ? 'Saving...' : 'Finish & Save Results'}
                onPress={handleSave}
                disabled={isSyncing}
              />
              <PrimaryButton
                label="Next Team Member Setup"
                variant="secondary"
                onPress={prepNextTeamMember}
                style={{ borderStyle: 'dashed', borderColor: primary }}
              />
            </View>
          ) : null}
        </StepPanel>
      </>
    );
  };

  const renderWriteupTab = () => (
    <View style={styles.tabContent}>
      <ColorPanel colour="lavender">
        <PanelTitle>Write-up prompts</PanelTitle>
        <PanelMuted style={styles.bodyMuted}>
          Use the questions below to complete your write-up in your exercise book.
        </PanelMuted>

      {[
        'Which movement was the hardest to keep the vibration low?',
        'Record the results.',
        'Were you right? Any surprises?',
      ].map((q, i) => (
        <PanelMuted key={q} style={styles.bulletPrompt}>
          {i + 1}. {q}
        </PanelMuted>
      ))}
      </ColorPanel>
    </View>
  );

  const renderDiscussionTab = () => (
    <View style={styles.tabContent}>
      <ColorPanel colour="sky">
        <PanelTitle>Discussion</PanelTitle>
        <PanelMuted style={styles.bodyMuted}>
          Muscles and joints work together to create movement. Faster movements often reduce control, while smoother movements show better coordination. Sensors in the phone measure how quickly and smoothly the body moves, helping students understand biomechanics and fatigue.
        </PanelMuted>

        <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>
          Why does speed reduce control?
        </PanelMuted>
        <PanelMuted style={styles.bodyMuted}>
          When you move faster, your muscles have less time to make fine adjustments. This causes more wobble and higher accelerometer readings. Slow, deliberate movements allow your nervous system to continuously correct your path.
        </PanelMuted>

        <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>
          What does the sensor actually measure?
        </PanelMuted>
        <PanelMuted style={styles.bodyMuted}>
          The accelerometer measures g-force — the rate of change in velocity in all three directions (x, y, z). When you move smoothly, these values stay close to 1g (gravity). Sudden jerks or fast movements spike the readings above 1g.
        </PanelMuted>

        <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>Curriculum links</PanelMuted>
        <PanelMuted style={styles.bulletPrompt}>• ACPPS051 — Movement skills</PanelMuted>
        <PanelMuted style={styles.bulletPrompt}>• ACPPS054 — Physical performance</PanelMuted>
        <PanelMuted style={styles.bulletPrompt}>• ACSSU176 — Structure and function of body systems</PanelMuted>
      </ColorPanel>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <PerformanceScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
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

          {screenTab === 'overview' && renderOverviewTab()}
          {screenTab === 'experiment' && (
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
              {renderExperimentTab()}
            </View>
          )}
          {screenTab === 'writeup' && renderWriteupTab()}
          {screenTab === 'discussion' && renderDiscussionTab()}

          {screenTab !== 'overview' && (
            <>
              {screenTab === 'experiment' ? (
                <PrimaryButton
                  label="Go to write-up"
                  variant="secondary"
                  onPress={() => {
                    setScreenTab('writeup');
                    requestAnimationFrame(() => scrollToTop(true));
                  }}
                  disabled={isSyncing}
                />
              ) : null}
              <PrimaryButton
                label="Back to dashboard"
                variant="secondary"
                onPress={() => router.back()}
                disabled={isSyncing}
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
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: SCREEN_BOTTOM_INSET,
    gap: Spacing.md,
  },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.sm },
  tabPill: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  tabContent: { gap: Spacing.lg },
  heroTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 2 },
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
  heroCtaText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  overviewActions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  bodyMuted: { fontSize: 13, lineHeight: 19, opacity: 0.88 },
  bulletPrompt: { fontSize: 13, lineHeight: 19, opacity: 0.88, marginTop: 6 },
  equipmentChecklist: { gap: Spacing.xs, marginTop: Spacing.sm },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  equipmentText: { flex: 1, fontSize: 13, fontWeight: '600' },
  equipmentStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  equipmentStatusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  missingEquipmentBlock: {
    flex: 1,
    gap: 4,
  },
  missingEquipmentItem: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontWeight: FontWeight.semibold,
  },
  movementLabel: { marginTop: Spacing.xs, fontSize: 14, fontWeight: '900' },
  diagramWrap: { marginTop: Spacing.xs, borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', padding: Spacing.sm },
  diagramImage: { width: '100%', aspectRatio: 680 / 382 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, opacity: 0.9, marginTop: 4 },
  liveForce: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: Spacing.sm },
  buttonRow: { flexDirection: 'row', marginTop: Spacing.sm },
  timerTrackField: {
    height: 24,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    justifyContent: 'center',
    position: 'relative',
  },
  timerProgressBarFill: { height: '100%', left: 0, position: 'absolute', opacity: 0.25 },
  timerPercentageText: { fontSize: 11, fontWeight: '700', paddingHorizontal: Spacing.sm, zIndex: 2 },
  attemptsWrap: { gap: Spacing.xs },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  stepBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  stepTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  stepBody: { gap: Spacing.sm },
});