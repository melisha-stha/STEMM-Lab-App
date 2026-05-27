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
import {
  SoundScreenBackground,
  useSoundScreenBackground,
} from '@/components/ui/sound-screen-background';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
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

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = ['lavender', 'sky', 'lavender'];

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

function meterToDb(meter: number): number {
  const clamped = Math.max(-160, Math.min(0, meter));
  return Math.round(((clamped + 160) / 160) * 120);
}

function useDbRisk(db: number) {
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const error = useThemeColor({}, 'error');
  const text = useThemeColor({}, 'text');

  if (db < 30) return { label: 'No Risk', color: success };
  if (db < 60) return { label: 'Safe', color: success };
  if (db < 85) return { label: 'Long Exposure Risk', color: warning };
  if (db < 90) return { label: 'Hearing Damage Possible', color: warning };
  if (db < 100) return { label: 'Hearing Damage Likely', color: error };
  if (db < 110) return { label: 'Serious Damage', color: error };
  if (db < 120) return { label: 'Painful', color: error };
  if (db < 130) return { label: 'Severe Damage', color: text };
  return { label: 'Instant Permanent Damage', color: text };
}

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={[styles.heroTitle, { color: textColor, fontFamily: pixelFamily }]}>
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
        Place the phone 30 cm from the sound source. Use the same distance for every measurement.
      </PanelMuted>
      <OverviewDiagramFrame />
    </>
  );
}

type SoundLiveRecordingProps = {
  liveDb: number;
  isRecording: boolean;
  isSyncing: boolean;
  measurementsCount: number;
  loudest: number | null;
  onToggleRecording: () => void;
  onReset: () => void;
};

function SoundLiveRecording({
  liveDb,
  isRecording,
  isSyncing,
  measurementsCount,
  loudest,
  onToggleRecording,
  onReset,
}: SoundLiveRecordingProps) {
  const { borderColor, cardIconBg } = usePanelTheme();
  const risk = useDbRisk(liveDb);
  const atLimit = measurementsCount >= MAX_MEASUREMENTS;

  return (
    <>
      <PanelMuted style={styles.stepHint}>
        Tap Start, perform the labelled action with the phone 30 cm away, then Stop to save the peak
        reading.
      </PanelMuted>

      <Text style={[styles.dbValue, { color: risk.color }]}>{liveDb} dB</Text>
      <View style={[styles.riskBadge, { backgroundColor: cardIconBg, borderColor: risk.color }]}>
        <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
      </View>

      <PrimaryButton
        label={isRecording ? 'Stop & save reading' : 'Start microphone'}
        variant={isRecording ? 'danger' : 'primary'}
        disabled={atLimit || isSyncing}
        onPress={onToggleRecording}
      />

      <View style={styles.buttonRow}>
        <View style={styles.buttonHalf}>
          <PrimaryButton
            label="Reset all"
            variant="secondary"
            onPress={onReset}
            disabled={isSyncing || (measurementsCount === 0 && !isRecording)}
          />
        </View>
      </View>

      <View style={styles.helperRow}>
        <PanelMuted style={styles.helper}>
          Measurements: {measurementsCount}/{MAX_MEASUREMENTS}
        </PanelMuted>
        {loudest !== null ? (
          <Text style={[styles.helperPeak, { color: borderColor }]}>Peak: {loudest} dB</Text>
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
      <PanelMuted style={[styles.fieldSubHintText, { marginTop: Spacing.xs }]}>
        Fill these cells on your physical worksheet during classroom testing.
      </PanelMuted>
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
  measurement: { db: number; label: string };
  isLoudest: boolean;
};

function MeasurementRow({ index, measurement, isLoudest }: MeasurementRowProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const { color: riskColor, label: riskLabel } = useDbRisk(measurement.db);

  return (
    <View
      style={[
        styles.measureRow,
        {
          borderColor: isLoudest ? riskColor : borderColor,
          backgroundColor: cardIconBg,
        },
      ]}>
      <View style={styles.measureRowMain}>
        <Text style={[styles.measureAction, { color: textColor }]}>
          Action {index + 1}: {measurement.label}
        </Text>
        <Text style={[styles.measureDb, { color: riskColor }]}>{measurement.db} dB</Text>
      </View>
      <View style={[styles.riskBadge, { backgroundColor: cardIconBg, borderColor: riskColor }]}>
        <Text style={[styles.riskLabel, { color: riskColor }]}>
          {isLoudest ? 'Peak' : riskLabel}
        </Text>
      </View>
    </View>
  );
}

export default function SoundScreen() {
  const router = useRouter();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useSoundScreenBackground();

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isRecording, setIsRecording] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  const [liveDb, setLiveDb] = useState(0);
  const [actionLabel, setActionLabel] = useState('');
  const [measurements, setMeasurements] = useState<{ db: number; label: string }[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const peakDbRef = useRef(0);

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const primarySoft = useThemeColor({}, 'primarySoft');
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

  useEffect(() => {
    return () => {
      void stopRecording();
      clearChallengeInterval();
    };
  }, [clearChallengeInterval]);

  const startRecording = async () => {
    if (measurements.length >= MAX_MEASUREMENTS) return;
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
    if (peakDb > 0 && measurements.length < MAX_MEASUREMENTS) {
      setMeasurements((prev) => [...prev, { db: peakDb, label: actionLabel.trim() }]);
      setActionLabel('');
      setLiveDb(0);
    }
  };

  const resetAll = () => {
    void stopRecording();
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

      stopChallengeTimer();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Sound data for ${teamData?.name || 'your team'} has been saved!`,
          data: { screen: 'sound' },
        },
        trigger: null,
      });

      Alert.alert('Saved!', 'Your sound measurements have been saved.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
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
                  onPress={() => setScreenTab(tab)}
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

              <Pressable
                accessibilityRole="button"
                onPress={() => setScreenTab('experiment')}
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
                <Text style={[styles.heroCtaText, { color: onPrimary, textAlign: 'center' }]}>
                  ▶  Start experiment
                </Text>
              </Pressable>
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

              <StepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Label your action">
                <PanelMuted style={styles.stepHint}>
                  Name the sound you are about to measure before you start the microphone.
                </PanelMuted>
                <Input
                  label="Action label"
                  placeholder='e.g. dropping a textbook, talking, walking'
                  value={actionLabel}
                  onChangeText={setActionLabel}
                  editable={!isRecording && measurements.length < MAX_MEASUREMENTS}
                />
              </StepPanel>

              <StepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Record sound level">
                <SoundLiveRecording
                  liveDb={liveDb}
                  isRecording={isRecording}
                  isSyncing={isSyncing}
                  measurementsCount={measurements.length}
                  loudest={loudest}
                  onToggleRecording={() =>
                    isRecording ? void stopRecording() : void startRecording()
                  }
                  onReset={resetAll}
                />
              </StepPanel>

              <StepPanel step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Your measurements">
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
                    disabled={isRecording || isSyncing}
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
                <PanelTitle>Worksheet reference table</PanelTitle>
                <WriteupWorksheetTable />
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
