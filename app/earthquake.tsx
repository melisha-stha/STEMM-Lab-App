import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelTitle,
  usePanelTableTokens,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import { AttemptRow } from '@/components/ui/attempt-row';
import {
  EarthquakeScreenBackground,
  useEarthquakeScreenBackground,
} from '@/components/ui/earthquake-screen-background';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { Input } from '@/components/ui/input';
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
import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { auth } from '../hooks/firebaseConfig';
import { uploadEarthquakeResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

export const options = {
  headerShown: false,
};

const EARTHQUAKE_DIAGRAM = require('@/assets/images/earthquake-diagram.jpeg');
const EARTHQUAKE_DIAGRAM_ASPECT = 680 / 382;

const ACTIVITY_EARTHQUAKE = 'earthquake';
const MAX_ATTEMPTS = 3;
const SENSOR_INTERVAL_MS = 100;
const TIMER_TICK_MS = 10;
const INITIAL_MIN_SCORE = 100;
const MAX_GRAPH_POINTS = 30;

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

interface SensorVector {
  x: number;
  y: number;
  z: number;
}

interface EarthquakeAttempt {
  designName: string;
  score: number;
  duration: number;
  folds?: number;
  pillars?: number;
  prediction?: 'low' | 'medium' | 'high';
}

const ZERO_VECTOR: SensorVector = { x: 0, y: 0, z: 0 };

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

const DESIGN_CONFIGURATIONS = [
  'Recommended design 1: 4 folds + 4 pillars',
  'Recommended design 2: 10 folds + 4 pillars',
  'Recommended design 3: 3 folds + 6 pillars',
] as const;

const OPTIONAL_CUSTOM_DESIGN = 'Custom design (Design 4)' as const;
const DESIGN_CONFIGURATIONS_ALL = [...DESIGN_CONFIGURATIONS, OPTIONAL_CUSTOM_DESIGN] as const;

const EQUIPMENT_ITEMS = [
  'Cardboard, paper, scissors, and sticky tape',
  'Plastic or paper cups (for pillars)',
  'Mobile phone with STEMM Lab app',
];

const INSTRUCTION_STEPS = [
  'Build an anti-vibration layer by folding paper or cardboard.',
  'Place a flat cardboard platform on top with the phone in the centre.',
  'Run the shaker test in the app for each of the three structure designs.',
  'Modify folds and pillars between tests to reduce movement.',
  'Upload your results when all three designs are logged.',
];

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = ['lavender', 'sky', 'lavender'];

type StepPanelProps = {
  step: number;
  title: string;
  colour?: ActivityCardColour;
  children: React.ReactNode;
};

function StepPanel({ step, title, colour = 'lavender', children }: StepPanelProps) {
  const { textColor, cardIconBg, borderColor } = useActivityCardColours(colour);

  return (
    <ColorPanel colour={colour}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: cardIconBg }]}>
          <Text style={[styles.stepBadgeText, { color: borderColor }]}>Step {step}</Text>
        </View>
        <Text style={[styles.stepTitle, { color: textColor }]}>{title}</Text>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </ColorPanel>
  );
}

const calculateStabilityScore = (gyro: SensorVector, accel: SensorVector): number => {
  const gyroMagnitude = Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2);
  const accelMagnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  const netAccel = Math.abs(accelMagnitude - 1);
  const movementIndex = gyroMagnitude * 0.6 + netAccel * 0.4;
  const score = Math.max(0, Math.min(100, 100 - movementIndex * 40));
  return Math.round(score);
};

function useStabilityPresentation(score: number) {
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const error = useThemeColor({}, 'error' as any) ?? '#EF4444';
  if (score >= 70) return { color: success, label: 'Stable' };
  if (score >= 40) return { color: warning, label: 'Moderate' };
  return { color: error, label: 'Unstable' };
}

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

const shortDesignLabel = (designName: string): string => designName.split(' (')[0] ?? designName;

const formatAttemptMetrics = (attempt: EarthquakeAttempt): string =>
  `${attempt.score} pts · ${formatTime(attempt.duration)}s`;

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Earthquake-Resistant Structure
    </Text>
  );
}

function OverviewDiagramFrame() {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.heroImageWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={EARTHQUAKE_DIAGRAM}
        style={styles.heroImage}
        contentFit="contain"
        accessibilityLabel="Diagram showing earthquake-resistant structure assembly with phone on platform"
      />
    </View>
  );
}

function OverviewInstructionList() {
  const { textColor, cardIconBg, borderColor } = usePanelTheme();
  return (
    <>
      {INSTRUCTION_STEPS.map((step, index) => (
        <View key={step} style={styles.instructionRow}>
          <View style={[styles.instructionNum, { backgroundColor: cardIconBg }]}>
            <Text style={[styles.instructionNumText, { color: borderColor }]}>{index + 1}</Text>
          </View>
          <Text style={[styles.instructionText, { color: textColor, opacity: 0.85 }]}>{step}</Text>
        </View>
      ))}
    </>
  );
}

function OverviewHowToConduct() {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const success = useThemeColor({}, 'success');
  const error = useThemeColor({}, 'error' as any) ?? '#EF4444';

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
      <PanelTitle>How to conduct the experiment</PanelTitle>
      <PanelMuted style={styles.equipmentIntro}>First, gather all this equipment:</PanelMuted>
      <PanelMuted style={styles.equipmentSelectHint}>
        Select all equipment you have gathered
      </PanelMuted>

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
                styles.equipmentCheckRow,
                {
                  borderColor: isChecked ? success : borderColor,
                  backgroundColor: cardIconBg,
                },
              ]}>
              <MaterialIcons
                name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={isChecked ? success : borderColor}
              />
              <Text
                style={[
                  styles.equipmentCheckLabel,
                  { color: textColor, fontWeight: isChecked ? '700' : '500' },
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
            {missingItems.map((item) => (
              <Text key={item} style={[styles.missingEquipmentItem, { color: error }]}>
                • {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

function OverviewStepByStep() {
  const { textColor } = usePanelTheme();

  return (
    <>
      <PanelTitle>Step-by-step</PanelTitle>
      <Text style={[styles.stepsSectionTitle, { color: textColor }]}>Step-by-step instructions</Text>
      <OverviewInstructionList />

      <PanelMuted style={[styles.diagramCaption, { marginTop: Spacing.md }]}>
        Place the phone in the centre of the platform before each shaker test.
      </PanelMuted>
      <OverviewDiagramFrame />
    </>
  );
}

function CustomDesignOptions({
  customFolds,
  setCustomFolds,
  customPillars,
  setCustomPillars,
  customPrediction,
  setCustomPrediction,
}: {
  customFolds: string;
  setCustomFolds: (v: string) => void;
  customPillars: string;
  setCustomPillars: (v: string) => void;
  customPrediction: 'low' | 'medium' | 'high' | null;
  setCustomPrediction: (v: 'low' | 'medium' | 'high') => void;
}) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const primary = useThemeColor({}, 'primary');

  return (
    <View style={styles.customDesignWrap}>
      <PanelMuted style={[styles.customDesignHint, { color: textColor }]}>
        Custom design details (shown only for design 4)
      </PanelMuted>
      <Input
        label="Folds (number of folds)"
        placeholder="e.g. 6"
        value={customFolds}
        onChangeText={setCustomFolds}
        keyboardType="number-pad"
      />
      <Input
        label="Pillars (number of pillars)"
        placeholder="e.g. 4"
        value={customPillars}
        onChangeText={setCustomPillars}
        keyboardType="number-pad"
      />

      <PanelMuted style={[styles.predictionLabel, { color: textColor }]}>Prediction</PanelMuted>
      <View style={styles.predictionRow}>
        {(['low', 'medium', 'high'] as const).map((opt) => {
          const selected = customPrediction === opt;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              accessibilityLabel={`Prediction ${opt}`}
              onPress={() => setCustomPrediction(opt)}
              style={[
                styles.predictionPill,
                selected && styles.predictionPillSelected,
                {
                  borderColor: selected ? primary : borderColor,
                  backgroundColor: selected ? `${primary}22` : cardIconBg,
                },
              ]}>
              <Text
                style={[
                  styles.predictionPillText,
                  selected && styles.predictionPillTextSelected,
                  { color: selected ? primary : textColor },
                ]}>
                {opt.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type StructureDesignsPanelProps = {
  designName: string;
  attempts: EarthquakeAttempt[];
  isActive: boolean;
  onSelectDesign: (label: string) => void;
};

function StructureDesignsPanel({
  designName,
  attempts,
  isActive,
  onSelectDesign,
}: StructureDesignsPanelProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');

  return (
    <>
      <PanelMuted style={styles.designIntro}>
        Test each design in order. Build the structure, then run the shaker test for that design.
      </PanelMuted>
      {DESIGN_CONFIGURATIONS_ALL.map((label) => {
        const isCurrent = designName === label;
        const isComplete = attempts.some((a) => a.designName === label);
        return (
          <Pressable
            key={label}
            disabled={isActive || isComplete}
            onPress={() => onSelectDesign(label)}
            style={[
              styles.designRow,
              {
                borderColor: isCurrent ? primary : borderColor,
                backgroundColor: isCurrent ? `${primary}14` : cardIconBg,
                opacity: isActive && !isCurrent ? 0.6 : 1,
              },
            ]}>
            <MaterialIcons
              name={
                isComplete ? 'check-circle' : isCurrent ? 'radio-button-checked' : 'radio-button-unchecked'
              }
              size={20}
              color={isComplete ? success : isCurrent ? primary : borderColor}
            />
            <Text style={[styles.designRowLabel, { color: textColor, fontWeight: isCurrent ? '700' : '500' }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

type EarthquakeStabilityMonitorProps = {
  isActive: boolean;
  time: number;
  liveScore: number;
  designName: string;
  gyroData: SensorVector;
  accelData: SensorVector;
  graphPath: string;
  stabilityColor: string;
  stabilityLabel: string;
  isSyncing: boolean;
  attemptsCount: number;
  hasOptionalAttempt: boolean;
  bestScore: number | null;
  onToggleTest: () => void;
  onReset: () => void;
};

function EarthquakeStabilityMonitor({
  isActive,
  time,
  liveScore,
  designName,
  gyroData,
  accelData,
  graphPath,
  stabilityColor,
  stabilityLabel,
  isSyncing,
  attemptsCount,
  hasOptionalAttempt,
  bestScore,
  onToggleTest,
  onReset,
}: EarthquakeStabilityMonitorProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const isOptionalSelected = designName === OPTIONAL_CUSTOM_DESIGN;

  if (Platform.OS === 'web') {
    return (
      <PanelMuted style={styles.webFallback}>
        Gyroscope and accelerometer are not available on web. Use a physical device to run this
        activity.
      </PanelMuted>
    );
  }

  return (
    <>
      <PanelMuted style={styles.stepHint}>
        Tap Start shaker test while the phone vibrates on your structure. Tap Stop & record when the
        test ends.
      </PanelMuted>

      <Text style={[styles.scoreValue, { color: stabilityColor }]}>{liveScore}</Text>
      <Text style={[styles.scoreLabel, { color: stabilityColor }]}>{stabilityLabel}</Text>
      <Text style={[styles.timerValue, { color: borderColor }]}>{formatTime(time)}s</Text>

      <View style={[styles.graphContainer, { borderColor, backgroundColor: cardIconBg }]}>
        <Svg height="80" width="100%">
          <Path d={graphPath} fill="none" stroke={stabilityColor} strokeWidth="3" />
        </Svg>
      </View>

      <PanelMuted style={styles.fieldLabel}>Current design</PanelMuted>
      <View style={[styles.currentDesignValue, { borderColor, backgroundColor: cardIconBg }]}>
        <Text style={[styles.currentDesignText, { color: textColor }]}>{designName}</Text>
      </View>

      <PanelMuted style={styles.sensorLine}>
        Gyro: x {gyroData.x.toFixed(3)} · y {gyroData.y.toFixed(3)} · z {gyroData.z.toFixed(3)} rad/s
      </PanelMuted>
      <PanelMuted style={styles.sensorLine}>
        Accel: x {accelData.x.toFixed(2)} · y {accelData.y.toFixed(2)} · z {accelData.z.toFixed(2)} g
      </PanelMuted>

      <PrimaryButton
        label={isActive ? 'Stop & record' : 'Start shaker test'}
        variant={isActive ? 'danger' : 'primary'}
        disabled={isSyncing || (!isActive && (isOptionalSelected ? hasOptionalAttempt : attemptsCount >= MAX_ATTEMPTS))}
        onPress={onToggleTest}
      />

      <PrimaryButton
        label="Reset all"
        variant="secondary"
        onPress={onReset}
        disabled={(time === 0 && attemptsCount === 0) || isSyncing || isActive}
      />

      <View style={styles.helperRow}>
        <PanelMuted style={styles.helper}>
          Attempts: {attemptsCount}/{MAX_ATTEMPTS}
        </PanelMuted>
        <Text style={[styles.helperPeak, { color: borderColor }]}>
          Best: {bestScore !== null ? `${bestScore} pts` : '—'}
        </Text>
      </View>
    </>
  );
}

function WriteupWorksheetTable() {
  const { textColor, borderColor } = usePanelTableTokens();
  const mutedCell = { color: textColor, opacity: 0.65, fontStyle: 'italic' as const };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.matrixTableGrid, { borderColor }]}>
        <View style={[styles.matrixHeaderRow, { borderBottomColor: borderColor }]}>
          <Text style={[styles.tableHeaderCell, { color: textColor, width: 180 }]}>Design</Text>
          <Text style={[styles.tableHeaderCell, { color: textColor, width: 120 }]}>Phone moves (cm)</Text>
          <Text style={[styles.tableHeaderCell, { color: textColor, width: 140 }]}>Outcome (degrees)</Text>
          <Text style={[styles.tableHeaderCell, { color: textColor, width: 120 }]}>Correct?</Text>
        </View>
        {DESIGN_CONFIGURATIONS.map((label, idx) => (
          <View
            key={label}
            style={[
              styles.matrixDataRow,
              { borderBottomWidth: idx === DESIGN_CONFIGURATIONS.length - 1 ? 0 : 1, borderBottomColor: borderColor },
            ]}>
            <Text style={[styles.tableBodyCell, { color: textColor, fontWeight: '600', width: 180 }]}>{label}</Text>
            <Text style={[styles.tableBodyCell, mutedCell, { width: 120 }]}>
              {idx === 0 ? 'e.g. ±1 cm' : 'Fill on paper...'}
            </Text>
            <Text style={[styles.tableBodyCell, mutedCell, { width: 140 }]}>
              {idx === 0 ? 'e.g. 4°' : 'Fill on paper...'}
            </Text>
            <Text style={[styles.tableBodyCell, mutedCell, { width: 120 }]}>[  ] Y / [  ] N</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function EarthquakeScreen() {
  const router = useRouter();
  const { getOptimizedLocation } = useBatteryTracker();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useEarthquakeScreenBackground();

  const scrollRef = useRef<ScrollView>(null);

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isActive, setIsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState<EarthquakeAttempt[]>([]);
  const [gyroData, setGyroData] = useState<SensorVector>(ZERO_VECTOR);
  const [accelData, setAccelData] = useState<SensorVector>(ZERO_VECTOR);
  const [liveScore, setLiveScore] = useState(INITIAL_MIN_SCORE);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  const [designName, setDesignName] = useState<string>(DESIGN_CONFIGURATIONS[0]);
  const [movementHistory, setMovementHistory] = useState<number[]>(new Array(MAX_GRAPH_POINTS).fill(0));
  const [customFolds, setCustomFolds] = useState('');
  const [customPillars, setCustomPillars] = useState('');
  const [customPrediction, setCustomPrediction] = useState<'low' | 'medium' | 'high' | null>(null);

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const minScoreRef = useRef(INITIAL_MIN_SCORE);
  const gyroSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const accelSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark' as any) ?? '#6B21A8';
  const primarySoft = useThemeColor({}, 'primarySoft' as any) ?? '#F3E8FF';
  const onPrimary = useThemeColor({}, 'onPrimary');
  const { color: stabilityColor, label: stabilityLabel } = useStabilityPresentation(liveScore);
  const bestScore =
    attempts.length > 0 ? Math.max(...attempts.map((attempt) => attempt.score)) : null;

  const requiredAttempts = attempts.filter((a) =>
    (DESIGN_CONFIGURATIONS as readonly string[]).includes(a.designName)
  );
  const requiredAttemptsCount = requiredAttempts.length;
  const hasOptionalAttempt = attempts.some((a) => a.designName === OPTIONAL_CUSTOM_DESIGN);

  const clearChallengeInterval = useCallback(() => {
    if (challengeIntervalRef.current) {
      clearInterval(challengeIntervalRef.current);
      challengeIntervalRef.current = null;
    }
  }, []);

  const stopChallengeTimer = useCallback(() => {
    clearChallengeInterval();
    setChallengeTimerRunning(false);
    setChallengeTimerFinished(true);
  }, [clearChallengeInterval]);

  const scrollToTop = useCallback((animated = true) => {
    scrollRef.current?.scrollTo({ y: 0, animated });
  }, []);

  const runChallengeInterval = useCallback(() => {
    const endAt = Date.now() + challengeRemainingMs;
    challengeIntervalRef.current = setInterval(() => {
      const next = Math.max(0, endAt - Date.now());
      setChallengeRemainingMs(next);
      if (next <= 0) {
        clearChallengeInterval();
        setChallengeTimerRunning(false);
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
  }, [
    challengeRemainingMs,
    challengeTimerFinished,
    challengeTimerRunning,
    runChallengeInterval,
  ]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

  useEffect(() => () => clearChallengeInterval(), [clearChallengeInterval]);

  useEffect(() => {
    if (isActive && Platform.OS !== 'web') {
      Vibration.vibrate([0, 400, 200, 400], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [isActive]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isActive) {
      return;
    }
    Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);
    gyroSubscriptionRef.current = Gyroscope.addListener(({ x, y, z }) => {
      setGyroData({ x, y, z });
    });
    return () => {
      gyroSubscriptionRef.current?.remove();
      gyroSubscriptionRef.current = null;
    };
  }, [isActive]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isActive) {
      return;
    }
    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    accelSubscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
      setAccelData({ x, y, z });
    });
    return () => {
      accelSubscriptionRef.current?.remove();
      accelSubscriptionRef.current = null;
    };
  }, [isActive]);

  useEffect(() => {
    const score = calculateStabilityScore(gyroData, accelData);
    setLiveScore(score);
    
    const absoluteDisplacement = 100 - score;
    
    if (isActive) {
      if (score < minScoreRef.current) {
        minScoreRef.current = score;
      }
      setMovementHistory((prev) => [...prev.slice(1), absoluteDisplacement]);
    }
  }, [gyroData, accelData, isActive]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime((prev) => {
          const newTime = prev + TIMER_TICK_MS;
          timeRef.current = newTime;
          return newTime;
        });
      }, TIMER_TICK_MS);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const stopSensors = (): void => {
    gyroSubscriptionRef.current?.remove();
    gyroSubscriptionRef.current = null;
    accelSubscriptionRef.current?.remove();
    accelSubscriptionRef.current = null;
    Vibration.cancel();
  };

  const startAttempt = (): void => {
    if (!designName.trim()) {
      Alert.alert('Configuration Required', 'Select a design before starting the shaker test.');
      return;
    }

    if (designName === OPTIONAL_CUSTOM_DESIGN) {
      const folds = Number.parseInt(customFolds, 10);
      const pillars = Number.parseInt(customPillars, 10);
      if (!Number.isFinite(folds) || folds < 0 || !Number.isFinite(pillars) || pillars < 0 || !customPrediction) {
        Alert.alert(
          'Custom Design Details Required',
          'Enter folds, pillars, and a prediction (low/medium/high) before starting Design 4.'
        );
        return;
      }
      if (hasOptionalAttempt) {
        Alert.alert('Already logged', 'Optional design 4 has already been recorded.');
        return;
      }
    } else if (requiredAttemptsCount >= MAX_ATTEMPTS) {
      Alert.alert('Required designs complete', 'You have already logged designs 1–3.');
      return;
    }

    setTime(0);
    timeRef.current = 0;
    minScoreRef.current = INITIAL_MIN_SCORE;
    setLiveScore(INITIAL_MIN_SCORE);
    setMovementHistory(new Array(MAX_GRAPH_POINTS).fill(0));
    setGyroData(ZERO_VECTOR);
    setAccelData(ZERO_VECTOR);
    setIsActive(true);
  };

  const stopAttempt = (): void => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopSensors();

    const finalTime = timeRef.current;
    const minScore = minScoreRef.current;
    
    if (finalTime > 0) {
      const isOptional = designName === OPTIONAL_CUSTOM_DESIGN;
      if (!isOptional && requiredAttemptsCount >= MAX_ATTEMPTS) return;
      if (isOptional && hasOptionalAttempt) return;

      const maybeCustom =
        isOptional
          ? {
              folds: Number.parseInt(customFolds, 10),
              pillars: Number.parseInt(customPillars, 10),
              prediction: customPrediction ?? undefined,
            }
          : {};

      setAttempts((prev) => [
        ...prev,
        { designName: designName.trim(), score: minScore, duration: finalTime, ...maybeCustom },
      ]);
      setTime(0);
      timeRef.current = 0;
      minScoreRef.current = INITIAL_MIN_SCORE;
      setLiveScore(INITIAL_MIN_SCORE);
      
      // Auto-advance only through required designs (1–3).
      if (!isOptional) {
        const nextDesignIndex = requiredAttemptsCount + 1;
        if (nextDesignIndex < MAX_ATTEMPTS) {
          setDesignName(DESIGN_CONFIGURATIONS[nextDesignIndex]);
          Alert.alert(`Trial ${nextDesignIndex} logged`, `Ready for ${DESIGN_CONFIGURATIONS[nextDesignIndex]}.`);
        } else {
          Alert.alert('All required designs logged', 'You can upload your results (Design 4 is optional).');
        }
      }
    }
  };

  const resetAll = (): void => {
    setIsActive(false);
    stopSensors();
    if (timerRef.current) clearInterval(timerRef.current);
    setTime(0);
    timeRef.current = 0;
    minScoreRef.current = INITIAL_MIN_SCORE;
    setLiveScore(INITIAL_MIN_SCORE);
    setMovementHistory(new Array(MAX_GRAPH_POINTS).fill(0));
    setAttempts([]);
    setDesignName(DESIGN_CONFIGURATIONS[0]);
    setGyroData(ZERO_VECTOR);
    setAccelData(ZERO_VECTOR);
    setCustomFolds('');
    setCustomPillars('');
    setCustomPrediction(null);
  };

  const finishAndSave = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to save your results.');
      return;
    }
    if (requiredAttemptsCount < MAX_ATTEMPTS) {
      Alert.alert(
        'Incomplete Trials',
        `Please log all ${MAX_ATTEMPTS} required structure design attempts before processing records.`
      );
      return;
    }

    setIsSyncing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationData: { latitude: number; longitude: number } | null = null;
      if (status === 'granted') {
        locationData = await getOptimizedLocation();        
      }

      const teamData = await getTeamData();
      const bestAttempt = requiredAttempts.reduce((best, attempt) =>
        attempt.score > best.score ? attempt : best
      );

      await Promise.all([
        uploadEarthquakeResult(user.uid, teamData, attempts, locationData),
        Promise.resolve(
          insertTrial(
            teamData?.name || 'unknown',
            ACTIVITY_EARTHQUAKE,
            bestAttempt.score,
            '',
            locationData?.latitude ?? null,
            locationData?.longitude ?? null
          )
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
        body: `${teamData?.name || 'Your team'} — Earthquake result saved. ${timeSummary}`,
        data: { screen: 'earthquake-results' },
      });

      router.push({
        pathname: '/earthquake-results',
        params: { attemptsJson: JSON.stringify(attempts) },
      });
    } catch (error) {
      console.error('Earthquake sync error:', error);
      Alert.alert('Sync Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const generateGraphPath = (): string => {
    const width = 300;
    const height = 80;
    const step = width / (MAX_GRAPH_POINTS - 1);
    
    return movementHistory
      .map((displacement, index) => {
        const x = index * step;
        const y = height - (displacement / 100) * (height - 10) - 5;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <EarthquakeScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}>
            {SCREEN_TABS.map((tab) => {
              const isSelected = screenTab === tab;
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
                      backgroundColor: isSelected ? primary : primarySoft,
                      borderColor: isSelected ? primary : border,
                    },
                  ]}>
                  <Text style={[styles.tabPillText, { color: isSelected ? onPrimary : primary }]}>
                    {SCREEN_TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {screenTab === 'overview' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                {pixelFontLoaded ? <OverviewHeroTitle pixelFamily={pixelFamily} /> : null}
                <PanelMuted style={styles.heroSubtitle}>Engineering · Earth Science</PanelMuted>
                <PanelMuted style={styles.heroBody}>
                  Design structures that withstand vibration, like real earthquakes. Test how folds and
                  pillars reduce movement across three prototypes.
                </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="yellow">
                <OverviewHowToConduct />
              </ColorPanel>

              <ColorPanel colour="sky">
                <OverviewStepByStep />
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
          )}

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

              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: primarySoft }]}>
                  <MaterialIcons name="location-on" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Location: {locationStatus}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: primarySoft }]}>
                  <MaterialIcons name="architecture" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Designs {requiredAttemptsCount} / {MAX_ATTEMPTS}
                  </Text>
                </View>
              </View>

              <StepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Choose structure design">
                <StructureDesignsPanel
                  designName={designName}
                  attempts={attempts}
                  isActive={isActive}
                  onSelectDesign={setDesignName}
                />

                {designName === OPTIONAL_CUSTOM_DESIGN ? (
                  <CustomDesignOptions
                    customFolds={customFolds}
                    setCustomFolds={setCustomFolds}
                    customPillars={customPillars}
                    setCustomPillars={setCustomPillars}
                    customPrediction={customPrediction}
                    setCustomPrediction={setCustomPrediction}
                  />
                ) : null}
              </StepPanel>

              <StepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Run shaker test">
                <EarthquakeStabilityMonitor
                  isActive={isActive}
                  time={time}
                  liveScore={liveScore}
                  designName={designName}
                  gyroData={gyroData}
                  accelData={accelData}
                  graphPath={generateGraphPath()}
                  stabilityColor={stabilityColor}
                  stabilityLabel={stabilityLabel}
                  isSyncing={isSyncing}
                  attemptsCount={requiredAttemptsCount}
                  hasOptionalAttempt={hasOptionalAttempt}
                  bestScore={bestScore}
                  onToggleTest={() => (isActive ? stopAttempt() : startAttempt())}
                  onReset={resetAll}
                />
              </StepPanel>

              <StepPanel step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Your results">
                {attempts.length === 0 ? (
                  <PanelMuted style={styles.emptyHint}>
                    No stability trials recorded yet — complete Step 2 for each design.
                  </PanelMuted>
                ) : (
                  <View style={styles.attemptsWrap}>
                    {attempts.map((attempt, index) => (
                      <AttemptRow
                        key={`${index}-${attempt.duration}`}
                        index={index + 1}
                        title={shortDesignLabel(attempt.designName)}
                        subtitle={formatAttemptMetrics(attempt)}
                        isLast={index === attempts.length - 1}
                      />
                    ))}
                  </View>
                )}
                {requiredAttemptsCount >= MAX_ATTEMPTS && (
                  <PrimaryButton
                    label={isSyncing ? 'Syncing...' : 'Upload results'}
                    variant="primary"
                    style={{ marginTop: Spacing.md }}
                    onPress={() => void finishAndSave()}
                    disabled={isActive || isSyncing}
                  />
                )}
              </StepPanel>
            </View>
          )}

          {screenTab === 'writeup' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                <PanelTitle>Write-up prompts</PanelTitle>
                <PanelMuted style={styles.softPanelHint}>
                  Answer these on your physical lab worksheet:
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Predict which fold design makes the phone move the least.
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Record the structural results after each shaker test.
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Were your engineering predictions correct?
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Did you discover any structural surprises while testing?
                </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="sky">
                <PanelTitle>Worksheet reference table</PanelTitle>
                <WriteupWorksheetTable />
              </ColorPanel>
            </View>
          )}

          {screenTab === 'discussion' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                <PanelTitle>Earthquakes & structures</PanelTitle>
                <PanelMuted style={styles.body}>
                  Earthquakes cause fast ground vibrations that can damage poorly designed buildings.
                  Engineers design structures to absorb, redirect, and spread energy safely.
                </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="sky">
                <PanelTitle>Curriculum links</PanelTitle>
                <PanelMuted style={styles.bullet}>
                  • ACSSU096 – Earth processes and tectonic activity.
                </PanelMuted>
                <PanelMuted style={[styles.bullet, { marginTop: Spacing.xs }]}>
                  • ACTDEP036 – Testing and improving designs with evidence.
                </PanelMuted>
              </ColorPanel>
            </View>
          )}

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
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: SCREEN_BOTTOM_INSET,
    gap: Spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  tabPill: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  tabContent: {
    gap: Spacing.lg,
  },
  heroImageWrap: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    width: '100%',
  },
  heroImage: {
    width: '100%',
    aspectRatio: EARTHQUAKE_DIAGRAM_ASPECT,
  },
  diagramCaption: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  heroBody: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
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
  equipmentIntro: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: FontWeight.semibold,
  },
  equipmentSelectHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  equipmentChecklist: {
    gap: Spacing.xs,
  },
  equipmentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  equipmentCheckLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
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
  sectionDivider: {
    height: 2,
    opacity: 0.35,
    marginVertical: Spacing.md,
  },
  stepsSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  instructionNum: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNumText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  instructionText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  stepHeader: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  stepTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  stepBody: {
    gap: Spacing.md,
  },
  stepHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
  },
  emptyHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  designIntro: {
    marginBottom: Spacing.sm,
  },
  designRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  designRowLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  customDesignWrap: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  customDesignHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  predictionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  predictionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  predictionPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 10,
    opacity: 0.9,
  },
  predictionPillSelected: {
    opacity: 1,
    transform: [{ translateY: -1 }],
  },
  predictionPillText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  predictionPillTextSelected: {
    textDecorationLine: 'underline',
  },
  scoreValue: {
    marginTop: Spacing.sm,
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xs,
  },
  timerValue: {
    marginTop: Spacing.md,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  graphContainer: {
    height: 85,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginVertical: Spacing.md,
    padding: Spacing.xs,
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  currentDesignValue: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  currentDesignText: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontWeight: FontWeight.semibold,
  },
  sensorLine: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  helper: {
    fontSize: FontSize.xs,
  },
  helperPeak: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  attemptsWrap: {
    gap: Spacing.sm,
  },
  webFallback: {
    lineHeight: 20,
  },
  softPanelHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  bulletPrompt: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  body: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  bullet: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  matrixTableGrid: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
  },
  matrixDataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  tableBodyCell: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
});