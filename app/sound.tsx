import { ActivityStepPanel } from '@/components/activity/ActivityStepPanel';
import { EquipmentChecklist } from '@/components/activity/EquipmentChecklist';
import { ResultMetricCard } from '@/components/activity/ResultMetricCard';
import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelTitle,
  usePanelTableTokens,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import {
  SoundScreenBackground,
  useSoundScreenBackground,
} from '@/components/ui/sound-screen-background';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { formatDuration } from '@/utils/formatters/duration';
import { insertTrial } from '@/hooks/database';
import { androidPixelPressableBox, usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useBatteryTracker } from '@/hooks/useBatteryTracker';
import {
  formatAboveBaseline,
  formatEstimatedLevel,
  getSoundTeachingRiskBand,
  medianEstimatedLevel,
  meteringDbFsToEstimatedLevel,
  smoothEstimatedLevels,
  SOUND_BASELINE_CAPTURE_MS,
  SOUND_METERING_UPDATE_MS,
  type SoundMeasurement,
  type SoundTeachingRiskSeverity,
} from '@/utils/calculations/sound-metering';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { scheduleAppNotification } from '@/hooks/notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { uploadSoundResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

export const options = {
  headerShown: false,
};

const SOUND_DIAGRAM = require('@/assets/images/sound-diagram.jpeg');
const SOUND_DIAGRAM_ASPECT = 650 / 556;
const MAX_MEASUREMENTS = 3;

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

const EQUIPMENT_ITEMS = [
  'Mobile phone with STEMM Lab app',
  'Book or object to make sound (e.g. textbook)',
  'Table or flat surface for consistent placement',
];

const INSTRUCTION_STEPS = [
  'Place the phone 30 cm from the sound source. Use the same distance for every measurement.',
  'Label each action before recording (e.g. dropping a book, talking, walking).',
  'Tap Start, perform the action, then Stop to save the peak decibel reading.',
  'Record up to 3 different actions and compare loud vs quiet zones in your classroom.',
  'Upload your measurements when finished.',
];

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = ['mint', 'lavender', 'sky', 'lavender'];

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

function useSoundRiskPalette() {
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const warning = useThemeColor({}, 'warning' as any) ?? '#FF9800';
  const error = useThemeColor({}, 'error' as any) ?? '#F44336';
  const primary = useThemeColor({}, 'primary');

  const colorForSeverity = (severity: SoundTeachingRiskSeverity): string => {
    switch (severity) {
      case 'quiet':
      case 'moderate':
        return success;
      case 'lively':
        return primary;
      case 'loud':
        return warning;
      case 'veryLoud':
        return error;
      default:
        return primary;
    }
  };

  return { colorForSeverity };
}

function useEstimatedSoundRisk(estimatedLevel: number) {
  const { colorForSeverity } = useSoundRiskPalette();
  const band = getSoundTeachingRiskBand(estimatedLevel);
  return { ...band, color: colorForSeverity(band.severity) };
}

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Sound Pollution Hunter
    </Text>
  );
}

function OverviewDiagramFrame() {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.heroImageWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={SOUND_DIAGRAM}
        style={styles.heroImage}
        contentFit="contain"
        accessibilityLabel="Diagram showing phone placement 30 cm from a sound source on a table"
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
  return (
    <>
      <PanelTitle>How to conduct the experiment</PanelTitle>
      <EquipmentChecklist items={EQUIPMENT_ITEMS} readyMessage="You are good to go!" />
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
        Place the phone 30 cm from the sound source. Use the same distance for every measurement.
      </PanelMuted>
      <OverviewDiagramFrame />
    </>
  );
}

type SoundBaselinePanelProps = {
  roomBaselineDb: number | null;
  isCapturingBaseline: boolean;
  isSyncing: boolean;
  onCaptureBaseline: () => void;
};

function SoundBaselinePanel({
  roomBaselineDb,
  isCapturingBaseline,
  isSyncing,
  onCaptureBaseline,
}: SoundBaselinePanelProps) {
  const { borderColor, cardIconBg, textColor } = usePanelTheme();
  const risk = useEstimatedSoundRisk(roomBaselineDb ?? 0);

  return (
    <>
      <PanelMuted style={styles.stepHint}>
        Hold the phone still at your testing spot while the room is quiet. We capture about{' '}
        {SOUND_BASELINE_CAPTURE_MS / 1000} seconds of microphone metering to set a room baseline.
        Phone microphones vary — compare actions using the same phone and distance (~30 cm).
      </PanelMuted>
      {roomBaselineDb != null ? (
        <View style={[styles.baselineSummary, { borderColor, backgroundColor: cardIconBg }]}>
          <Text style={[styles.baselineTitle, { color: textColor }]}>Room baseline captured</Text>
          <Text style={[styles.dbValue, styles.baselineValue, { color: risk?.color ?? textColor }]}>
            {formatEstimatedLevel(roomBaselineDb)}
          </Text>
          <Text style={[styles.baselineMeta, { color: borderColor }]}>{risk.label}</Text>
        </View>
      ) : (
        <PanelMuted style={styles.baselineMeta}>
          No baseline yet — capture quiet-room levels before measuring actions.
        </PanelMuted>
      )}
      <PrimaryButton
        label={
          isCapturingBaseline
            ? 'Capturing baseline…'
            : roomBaselineDb != null
              ? 'Recalibrate room baseline'
              : 'Capture room baseline'
        }
        variant={isCapturingBaseline ? 'danger' : 'secondary'}
        disabled={isCapturingBaseline || isSyncing}
        onPress={onCaptureBaseline}
      />
    </>
  );
}

type SoundLiveRecordingProps = {
  liveEstimated: number;
  liveAboveBaseline: number | null;
  roomBaselineDb: number | null;
  isRecordingAction: boolean;
  isSyncing: boolean;
  measurementsCount: number;
  loudest: number | null;
  onToggleRecording: () => void;
  onReset: () => void;
};

function SoundLiveRecording({
  liveEstimated,
  liveAboveBaseline,
  roomBaselineDb,
  isRecordingAction,
  isSyncing,
  measurementsCount,
  loudest,
  onToggleRecording,
  onReset,
}: SoundLiveRecordingProps) {
  const { borderColor, cardIconBg } = usePanelTheme();
  const risk = useEstimatedSoundRisk(liveEstimated);
  const atLimit = measurementsCount >= MAX_MEASUREMENTS;
  const baselineReady = roomBaselineDb != null;

  return (
    <>
      <PanelMuted style={styles.stepHint}>
        Tap Start, perform the labelled action with the phone 30 cm away, then Stop to save the peak
        reading. Levels are estimated from the microphone — not a certified sound pressure meter.
      </PanelMuted>

      <Text style={[styles.meterLabel, { color: borderColor }]}>Estimated sound level</Text>
      <Text style={[styles.dbValue, { color: risk.color }]}>
        {liveEstimated > 0 ? formatEstimatedLevel(liveEstimated) : '—'}
      </Text>
      {liveAboveBaseline != null && liveAboveBaseline > 0 ? (
        <Text style={[styles.aboveBaselineLine, { color: risk.color }]}>
          {formatAboveBaseline(liveAboveBaseline)}
        </Text>
      ) : null}
      {roomBaselineDb != null ? (
        <PanelMuted style={styles.baselineMeta}>
          Room baseline: {formatEstimatedLevel(roomBaselineDb)}
        </PanelMuted>
      ) : null}
      <View style={[styles.riskBadge, { backgroundColor: cardIconBg, borderColor: risk.color }]}>
        <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
      </View>

      <PrimaryButton
        label={isRecordingAction ? 'Stop & save peak reading' : 'Start action recording'}
        variant={isRecordingAction ? 'danger' : 'primary'}
        disabled={atLimit || isSyncing || !baselineReady}
        onPress={onToggleRecording}
      />

      <View style={styles.buttonRow}>
        <View style={styles.buttonHalf}>
          <PrimaryButton
            label="Reset all"
            variant="secondary"
            onPress={onReset}
            disabled={isSyncing || (measurementsCount === 0 && !isRecordingAction)}
          />
        </View>
      </View>

      <View style={styles.helperRow}>
        <PanelMuted style={styles.helper}>
          Measurements: {measurementsCount}/{MAX_MEASUREMENTS}
        </PanelMuted>
        {loudest !== null ? (
          <Text style={[styles.helperPeak, { color: borderColor }]}>
            Peak reading: {formatEstimatedLevel(loudest)}
          </Text>
        ) : null}
      </View>
    </>
  );
}

function WriteupWorksheetTable() {
  const { textColor, borderColor } = usePanelTableTokens();
  const mutedCell = { color: textColor, opacity: 0.65, fontStyle: 'italic' as const };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.matrixTableGrid, { borderColor }]}>
          <View style={[styles.matrixHeaderRow, { borderBottomColor: borderColor }]}>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 140 }]}>Action</Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 150 }]}>
              Prediction (Louder / Softer)
            </Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 110 }]}>Result (dB)</Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 110 }]}>
              Hypothesis correct?
            </Text>
          </View>
          {[
            { id: '1', label: 'Action 1: Drop book on table' },
            { id: '2', label: 'Action 2' },
            { id: '3', label: 'Action 3' },
          ].map((row, idx) => (
            <View
              key={row.id}
              style={[
                styles.matrixDataRow,
                { borderBottomWidth: idx === 2 ? 0 : 1, borderBottomColor: borderColor },
              ]}>
              <Text style={[styles.tableBodyCell, { color: textColor, fontWeight: '600', width: 140 }]}>
                {row.label}
              </Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 150 }]}>Fill on paper...</Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 110 }]}>Fill on paper...</Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 110 }]}>[  ] Yes / [  ] No</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={[styles.fieldSubHintText, { marginTop: Spacing.xs }]}>
        Fill these cells on your physical worksheet during classroom testing.
      </Text>
    </>
  );
}

function HearingDamageTable() {
  const { textColor, borderColor } = usePanelTableTokens();

  return (
    <View style={[styles.hearingTable, { borderColor }]}>
      <View style={[styles.matrixHeaderRow, { borderBottomColor: borderColor }]}>
        <Text style={[styles.tableHeaderCell, styles.hearingColLevel, { color: textColor }]}>
          Sound level
        </Text>
        <Text style={[styles.tableHeaderCell, styles.hearingColExamples, { color: textColor }]}>
          Example sounds
        </Text>
        <Text style={[styles.tableHeaderCell, styles.hearingColRisk, { color: textColor }]}>
          Risk to hearing
        </Text>
      </View>
      {SOUND_LEVEL_TABLE_ROWS.map((row, index) => (
        <View
          key={row.level}
          style={[
            styles.hearingTableRow,
            { borderBottomColor: borderColor, borderBottomWidth: index === SOUND_LEVEL_TABLE_ROWS.length - 1 ? 0 : 1 },
          ]}>
          <Text style={[styles.tableBodyCell, styles.hearingColLevel, { color: row.color, fontWeight: '700' }]}>
            {row.level}
          </Text>
          <Text style={[styles.tableBodyCell, styles.hearingColExamples, { color: textColor, opacity: 0.85 }]}>
            {row.examples}
          </Text>
          <Text style={[styles.tableBodyCell, styles.hearingColRisk, { color: row.color, fontWeight: '600' }]}>
            {row.risk}
          </Text>
        </View>
      ))}
    </View>
  );
}

type MeasurementRowProps = {
  index: number;
  measurement: SoundMeasurement;
  isLoudest: boolean;
};

function MeasurementRow({ index, measurement, isLoudest }: MeasurementRowProps) {
  const { borderColor } = usePanelTheme();
  const { color: riskColor, label: riskLabel } = useEstimatedSoundRisk(measurement.db);
  const sublines: string[] = [];
  if (measurement.avgDb != null) {
    sublines.push(`Avg during action: ${formatEstimatedLevel(measurement.avgDb)}`);
  }
  if (measurement.aboveBaselineDb != null && measurement.aboveBaselineDb > 0) {
    sublines.push(formatAboveBaseline(measurement.aboveBaselineDb));
  }

  return (
    <ResultMetricCard
      title={`Action ${index + 1}: ${measurement.label}`}
      primaryLine={`Peak reading: ${formatEstimatedLevel(measurement.db)}`}
      primaryColor={riskColor}
      sublines={sublines}
      sublineColor={borderColor}
      badgeLabel={isLoudest ? 'Peak' : riskLabel}
      badgeBorderColor={riskColor}
      highlighted={isLoudest}
    />
  );
}

export default function SoundScreen() {
  const router = useRouter();
  const { getOptimizedLocation } = useBatteryTracker();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useSoundScreenBackground();

  const scrollRef = useRef<ScrollView>(null);

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [recordingMode, setRecordingMode] = useState<'baseline' | 'action' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  const [liveEstimated, setLiveEstimated] = useState(0);
  const [liveAboveBaseline, setLiveAboveBaseline] = useState<number | null>(null);
  const [roomBaselineDb, setRoomBaselineDb] = useState<number | null>(null);
  const [actionLabel, setActionLabel] = useState('');
  const [measurements, setMeasurements] = useState<SoundMeasurement[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingModeRef = useRef<'baseline' | 'action' | null>(null);
  const baselineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peakEstimatedRef = useRef(0);
  const sumEstimatedRef = useRef(0);
  const sampleCountRef = useRef(0);
  const smoothingSamplesRef = useRef<number[]>([]);
  const sessionSamplesRef = useRef<number[]>([]);
  const roomBaselineRef = useRef<number | null>(null);

  const isCapturingBaseline = recordingMode === 'baseline';
  const isRecordingAction = recordingMode === 'action';

  useEffect(() => {
    roomBaselineRef.current = roomBaselineDb;
  }, [roomBaselineDb]);

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark' as any) ?? '#6B21A8';
  const primarySoft = useThemeColor({}, 'primarySoft' as any) ?? '#F3E8FF';
  const onPrimary = useThemeColor({}, 'onPrimary');

  const loudest = measurements.length ? Math.max(...measurements.map((m) => m.db)) : null;

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

  const clearBaselineTimer = useCallback(() => {
    if (baselineTimerRef.current) {
      clearTimeout(baselineTimerRef.current);
      baselineTimerRef.current = null;
    }
  }, []);

  const resetMeteringSession = useCallback(() => {
    peakEstimatedRef.current = 0;
    sumEstimatedRef.current = 0;
    sampleCountRef.current = 0;
    smoothingSamplesRef.current = [];
    sessionSamplesRef.current = [];
    setLiveEstimated(0);
    setLiveAboveBaseline(null);
  }, []);

  const handleMeteringSample = useCallback((dbfs: number) => {
    const estimated = meteringDbFsToEstimatedLevel(dbfs);
    smoothingSamplesRef.current.push(estimated);
    const smoothed = smoothEstimatedLevels(smoothingSamplesRef.current);
    sessionSamplesRef.current.push(smoothed);

    peakEstimatedRef.current = Math.max(peakEstimatedRef.current, smoothed);
    sumEstimatedRef.current += smoothed;
    sampleCountRef.current += 1;

    setLiveEstimated(smoothed);
    const baseline = roomBaselineRef.current;
    setLiveAboveBaseline(baseline != null ? Math.max(0, smoothed - baseline) : null);
  }, []);

  const finishMeteringSession = useCallback(async () => {
    clearBaselineTimer();

    if (!recordingRef.current) {
      setRecordingMode(null);
      recordingModeRef.current = null;
      return;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
    } catch (_) {}
    recordingRef.current = null;

    const mode = recordingModeRef.current;
    recordingModeRef.current = null;
    setRecordingMode(null);

    if (mode === 'baseline') {
      const baseline =
        medianEstimatedLevel(sessionSamplesRef.current) || peakEstimatedRef.current;
      if (baseline > 0) {
        setRoomBaselineDb(baseline);
        roomBaselineRef.current = baseline;
      }
      resetMeteringSession();
      return;
    }

    if (mode === 'action') {
      const peak = peakEstimatedRef.current;
      const sampleCount = sampleCountRef.current;
      const avg =
        sampleCount > 0 ? Math.round(sumEstimatedRef.current / sampleCount) : peak;
      const baseline = roomBaselineRef.current;
      const aboveBaseline =
        baseline != null && peak > 0 ? Math.max(0, peak - baseline) : undefined;

      const label = actionLabel.trim();
      setMeasurements((prev) => {
        if (peak <= 0 || prev.length >= MAX_MEASUREMENTS || !label) return prev;
        return [
          ...prev,
          {
            db: peak,
            label,
            avgDb: avg,
            aboveBaselineDb: aboveBaseline,
          },
        ];
      });
      if (peak > 0 && label) {
        setActionLabel('');
      }
      resetMeteringSession();
    }
  }, [actionLabel, clearBaselineTimer, resetMeteringSession]);

  const startMeteringSession = useCallback(
    async (mode: 'baseline' | 'action') => {
      if (mode === 'action') {
        if (measurements.length >= MAX_MEASUREMENTS) return;
        if (!actionLabel.trim()) {
          Alert.alert('Add a label', 'Describe the action first (e.g. "dropping a book").');
          return;
        }
        if (roomBaselineRef.current == null) {
          Alert.alert('Capture baseline first', 'Record a quiet room baseline before actions.');
          return;
        }
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

      resetMeteringSession();

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            handleMeteringSample(status.metering);
          }
        },
        SOUND_METERING_UPDATE_MS
      );

      recordingRef.current = recording;
      recordingModeRef.current = mode;
      setRecordingMode(mode);

      if (mode === 'baseline') {
        baselineTimerRef.current = setTimeout(() => {
          void finishMeteringSession();
        }, SOUND_BASELINE_CAPTURE_MS);
      }
    },
    [actionLabel, finishMeteringSession, handleMeteringSample, measurements.length, resetMeteringSession]
  );

  useEffect(() => {
    return () => {
      clearBaselineTimer();
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      clearChallengeInterval();
    };
  }, [clearBaselineTimer, clearChallengeInterval]);

  const startActionRecording = () => void startMeteringSession('action');
  const captureRoomBaseline = () => void startMeteringSession('baseline');
  const stopActiveRecording = () => void finishMeteringSession();

  const resetAll = () => {
    clearBaselineTimer();
    if (recordingRef.current) {
      void recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    recordingModeRef.current = null;
    setRecordingMode(null);
    setMeasurements([]);
    setActionLabel('');
    setRoomBaselineDb(null);
    roomBaselineRef.current = null;
    resetMeteringSession();
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
        locationData = await getOptimizedLocation();      
      }

      const teamData = await getTeamData();
      const peakDb = Math.max(...measurements.map((m) => m.db));

      await Promise.all([
        uploadSoundResult(user.uid, teamData, measurements, locationData),
        Promise.resolve(
          insertTrial(
            teamData?.name || 'unknown',
            'sound',
            peakDb,
            '',
            locationData?.latitude || null,
            locationData?.longitude || null
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
        body: `Sound data for ${teamData?.name || 'your team'} has been saved!`,
      });

      Alert.alert('Saved!', `Your sound measurements have been saved.\n\n${timeSummary}`, [
        { 
          text: 'OK', 
          onPress: () => {
            router.push({
              pathname: '/sound-results' as any,
              params: { measurementsJson: JSON.stringify(measurements) },
            });
          } 
        },
      ]);
    } catch (error) {
      console.error('Sound Save Error:', error);
      Alert.alert('Save Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SoundScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
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
              <ColorPanel colour="peach">
                {pixelFontLoaded ? <OverviewHeroTitle pixelFamily={pixelFamily} /> : null}
                <PanelMuted style={styles.heroSubtitle}>Health · Physics</PanelMuted>
                <PanelMuted style={styles.heroBody}>
                  Measure and compare sound intensity levels from different actions in your classroom.
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
                  <MaterialIcons name="graphic-eq" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Readings {measurements.length} / {MAX_MEASUREMENTS}
                  </Text>
                </View>
              </View>

              <ActivityStepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Room baseline">
                <SoundBaselinePanel
                  roomBaselineDb={roomBaselineDb}
                  isCapturingBaseline={isCapturingBaseline}
                  isSyncing={isSyncing}
                  onCaptureBaseline={captureRoomBaseline}
                />
              </ActivityStepPanel>

              <ActivityStepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Label your action">
                <PanelMuted style={styles.stepHint}>
                  Name the sound you are about to measure before you start the microphone.
                </PanelMuted>
                <Input
                  label="Action label"
                  placeholder='e.g. dropping a textbook, talking, walking'
                  value={actionLabel}
                  onChangeText={setActionLabel}
                  editable={
                    !isRecordingAction &&
                    !isCapturingBaseline &&
                    measurements.length < MAX_MEASUREMENTS
                  }
                />
              </ActivityStepPanel>

              <ActivityStepPanel step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Record sound level">
                <SoundLiveRecording
                  liveEstimated={liveEstimated}
                  liveAboveBaseline={liveAboveBaseline}
                  roomBaselineDb={roomBaselineDb}
                  isRecordingAction={isRecordingAction}
                  isSyncing={isSyncing}
                  measurementsCount={measurements.length}
                  loudest={loudest}
                  onToggleRecording={() =>
                    isRecordingAction ? void stopActiveRecording() : void startActionRecording()
                  }
                  onReset={resetAll}
                />
              </ActivityStepPanel>

              <ActivityStepPanel step={4} colour={EXPERIMENT_STEP_COLOURS[3]} title="Your measurements">
                {measurements.length === 0 ? (
                  <PanelMuted style={styles.emptyHint}>
                    No readings yet — complete Step 2 to log your first measurement.
                  </PanelMuted>
                ) : (
                  <View style={styles.measureList}>
                    {measurements.map((m, i) => (
                      <MeasurementRow
                        key={`${m.label}-${i}`}
                        index={i}
                        measurement={m}
                        isLoudest={m.db === loudest}
                      />
                    ))}
                  </View>
                )}
                {measurements.length > 0 && (
                  <PrimaryButton
                    label={isSyncing ? 'Syncing...' : 'Upload results'}
                    variant="primary"
                    style={{ marginTop: Spacing.md }}
                    onPress={() => void finishAndSave()}
                    disabled={isRecordingAction || isCapturingBaseline || isSyncing}
                  />
                )}
              </ActivityStepPanel>
            </View>
          )}

          {screenTab === 'writeup' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                <PanelTitle>Write-up prompts</PanelTitle>
                <PanelMuted style={styles.softPanelHint}>
                  Use these questions as a guide for your physical worksheet:
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Predict which school action creates the highest sound intensity.
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Record the decibel readings on your worksheet.
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Were your predictions correct?
                </PanelMuted>
                <PanelMuted style={styles.bulletPrompt}>
                  • Did any readings surprise you?
                </PanelMuted>
                <PanelMuted style={[styles.bulletPrompt, { fontWeight: FontWeight.bold }]}>
                  • Should students or teachers wear ear protection in your classroom?
                </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="sky">
                <OverviewWorksheetReferenceTable />
              </ColorPanel>
            </View>
          )}

          {screenTab === 'discussion' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="peach">
                <PanelTitle>Sound, energy & health</PanelTitle>
                <PanelMuted style={styles.body}>
                  Sound intensity depends on the energy of the source and the surfaces it hits. Prolonged
                  exposure to loud noise can affect concentration, wellbeing, and hearing.
                </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="lavender">
                <PanelTitle>Hearing damage safety grid</PanelTitle>
                <HearingDamageTable />
              </ColorPanel>

              <ColorPanel colour="sky">
                <PanelTitle>Curriculum links</PanelTitle>
                <PanelMuted style={styles.bullet}>
                  • Science (Physics): wave mechanics, sound intensity, and energy transfer.
                </PanelMuted>
                <PanelMuted style={[styles.bullet, { marginTop: 2 }]}>
                  • Health: environmental hazards and auditory wellbeing.
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

function OverviewWorksheetReferenceTable() {
  return <WriteupWorksheetTable />;
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
    aspectRatio: SOUND_DIAGRAM_ASPECT,
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
  dbValue: {
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: Spacing.xs,
  },
  baselineValue: {
    fontSize: 40,
  },
  baselineSummary: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  baselineTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  baselineMeta: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  meterLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  aboveBaselineLine: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  measureSubline: {
    fontSize: FontSize.xs,
    lineHeight: 17,
  },
  riskBadge: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  riskLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  buttonHalf: {
    flex: 1,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  helper: {
    fontSize: FontSize.xs,
  },
  helperPeak: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  measureList: {
    gap: Spacing.sm,
  },
  measureRow: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  measureRowMain: {
    flex: 1,
    gap: 2,
  },
  measureAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  measureDb: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  matrixTableGrid: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
  },
  matrixDataRow: {
    flexDirection: 'row',
    paddingVertical: 12,
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
  hearingTable: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  hearingTableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  hearingColLevel: {
    width: 72,
  },
  hearingColExamples: {
    flex: 1,
  },
  hearingColRisk: {
    flex: 1,
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
  fieldSubHintText: {
    fontSize: FontSize.xs,
    lineHeight: 14,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  bullet: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
});