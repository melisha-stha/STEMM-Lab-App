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
import { PrimaryButton } from '@/components/ui/primary-button';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
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
  'Design 1 (e.g. 4 folds + 4 pillars)',
  'Design 2 (e.g. 10 folds + 4 pillars)',
  'Design 3 (e.g. 3 folds and 6 pillars)',
] as const;

const EQUIPMENT_ITEMS = [
  'Cardboard, paper, scissors, sticky tape, plastic or paper cups',
  'Mobile phone with vibration sensor (STEMM Lab app)',
];

const INSTRUCTION_STEPS = [
  'Build an anti-vibration layer by folding paper or cardboard.',
  'Place a flat cardboard platform on top.',
  'Place the phone in the centre and start the shaker test in the app.',
  'Modify the structure to reduce movement (more pillars, more folds, etc.).',
];

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
  const error = useThemeColor({}, 'error');
  if (score >= 70) return { color: success, label: 'Stable' };
  if (score >= 40) return { color: warning, label: 'Moderate' };
  return { color: error, label: 'Unstable' };
}

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

const formatAttemptValue = (attempt: EarthquakeAttempt): string =>
  `${attempt.designName} · ${attempt.score} pts · ${formatTime(attempt.duration)}s`;

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={[styles.heroTitle, { color: textColor, fontFamily: pixelFamily }]}>
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

function OverviewEquipmentList() {
  const { textColor, borderColor } = usePanelTheme();
  return (
    <View style={styles.listContainer}>
      {EQUIPMENT_ITEMS.map((item) => (
        <View key={item} style={styles.listRow}>
          <MaterialIcons name="check-circle" size={16} color={borderColor} />
          <Text style={[styles.listItem, { color: textColor, opacity: 0.85 }]}>{item}</Text>
        </View>
      ))}
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

type StructureDesignsPanelProps = {
  designName: string;
  attempts: EarthquakeAttempt[];
  primary: string;
  success: string;
};

function StructureDesignsPanel({ designName, attempts, primary, success }: StructureDesignsPanelProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();

  return (
    <>
      <PanelTitle>Structure designs</PanelTitle>
      <PanelMuted style={styles.designIntro}>
        Test each design in order. Build the structure, then run the shaker test for that design.
      </PanelMuted>
      {DESIGN_CONFIGURATIONS.map((label) => {
        const isCurrent = designName === label;
        const isComplete = attempts.some((a) => a.designName === label);
        return (
          <View
            key={label}
            style={[
              styles.designRow,
              {
                borderColor: isCurrent ? primary : borderColor,
                backgroundColor: isCurrent ? `${primary}14` : cardIconBg,
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
          </View>
        );
      })}
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
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useEarthquakeScreenBackground();

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isActive, setIsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState<EarthquakeAttempt[]>([]);
  const [gyroData, setGyroData] = useState<SensorVector>(ZERO_VECTOR);
  const [accelData, setAccelData] = useState<SensorVector>(ZERO_VECTOR);
  const [liveScore, setLiveScore] = useState(INITIAL_MIN_SCORE);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  
  // Custom Workspace State Variables
  const [designName, setDesignName] = useState<string>(DESIGN_CONFIGURATIONS[0]);
  const [movementHistory, setMovementHistory] = useState<number[]>(new Array(MAX_GRAPH_POINTS).fill(0));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const minScoreRef = useRef(INITIAL_MIN_SCORE);
  const gyroSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const accelSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const success = useThemeColor({}, 'success');
  const cardIconBg = useThemeColor({}, 'cardIconBg');

  const { color: stabilityColor, label: stabilityLabel } = useStabilityPresentation(liveScore);
  const bestScore =
    attempts.length > 0 ? Math.max(...attempts.map((attempt) => attempt.score)) : null;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

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
    
    // Convert stability reduction to absolute kinetic acceleration displacement
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
    
    if (finalTime > 0 && attempts.length < MAX_ATTEMPTS) {
      setAttempts((prev) => [
        ...prev, 
        { designName: designName.trim(), score: minScore, duration: finalTime }
      ]);
      setTime(0);
      timeRef.current = 0;
      minScoreRef.current = INITIAL_MIN_SCORE;
      setLiveScore(INITIAL_MIN_SCORE);
      
      const nextDesignIndex = attempts.length + 1;
      if (nextDesignIndex < MAX_ATTEMPTS) {
        setDesignName(DESIGN_CONFIGURATIONS[nextDesignIndex]);
        Alert.alert(
          `Trial ${nextDesignIndex} logged`,
          `Ready for ${DESIGN_CONFIGURATIONS[nextDesignIndex]}.`
        );
      } else {
        Alert.alert('All trials logged', 'You can finish and save your results.');
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
  };

  const finishAndSave = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to save your results.');
      return;
    }
    if (attempts.length < MAX_ATTEMPTS) {
      Alert.alert('Incomplete Trials', `Please log all ${MAX_ATTEMPTS} structure design attempts before processing records.`);
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
      const bestAttempt = attempts.reduce((best, attempt) =>
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

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `${teamData?.name || 'Your team'} — Earthquake result saved`,
          data: { screen: 'earthquake-results' },
        },
        trigger: null,
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

  // ✅ Inverted Waveform rendering: 0 maps to floor line (height-5), 100 spikes upwards (5)
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
              <ColorPanel colour="lavender">
                {pixelFontLoaded ? <OverviewHeroTitle pixelFamily={pixelFamily} /> : null}
                <PanelMuted style={styles.heroSubtitle}>Engineering · Earth Science</PanelMuted>
                <PanelMuted style={styles.heroBody}>
                  Design structures that withstand vibration, like real earthquakes. Test how folds and
                  pillars reduce movement across three prototypes.
                </PanelMuted>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setScreenTab('experiment')}
                  style={[
                    styles.heroCta,
                    {
                      backgroundColor: primary,
                      borderColor: primary,
                      borderBottomColor: primaryDark,
                    },
                  ]}>
                  <Text style={[styles.heroCtaText, { color: onPrimary }]}>▶  Start experiment</Text>
                </Pressable>
              </ColorPanel>

              <ColorPanel colour="sky">
                <PanelTitle>How to conduct the experiment</PanelTitle>
                <PanelMuted style={styles.diagramCaption}>
                  Place the phone in the centre of the platform before each shaker test.
                </PanelMuted>
                <OverviewDiagramFrame />
              </ColorPanel>

              <ColorPanel colour="peach">
                <PanelTitle>Equipment</PanelTitle>
                <OverviewEquipmentList />
              </ColorPanel>

              <ColorPanel colour="lavender">
                <PanelTitle>How it works</PanelTitle>
                <OverviewInstructionList />
              </ColorPanel>
            </View>
          )}

          {screenTab === 'experiment' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="sky">
                <StructureDesignsPanel
                  designName={designName}
                  attempts={attempts}
                  primary={primary}
                  success={success}
                />
              </ColorPanel>

              <ColorPanel colour="lavender">
                <PanelTitle>Stability monitor</PanelTitle>

                {Platform.OS === 'web' ? (
                  <PanelMuted style={styles.webFallback}>
                    Gyroscope and accelerometer are not available on web. Use a physical device to run
                    this activity.
                  </PanelMuted>
                ) : (
                  <>
                    <Text style={[styles.scoreValue, { color: stabilityColor }]}>{liveScore}</Text>
                    <Text style={[styles.scoreLabel, { color: stabilityColor }]}>{stabilityLabel}</Text>
                    <Text style={[styles.timerValue, { color: primary }]}>{formatTime(time)}s</Text>

                    <View style={[styles.graphContainer, { borderColor: primary, backgroundColor: cardIconBg }]}>
                      <Svg height="80" width="100%">
                        <Path d={generateGraphPath()} fill="none" stroke={stabilityColor} strokeWidth="3" />
                      </Svg>
                    </View>

                    <PanelMuted style={styles.fieldLabel}>Current design</PanelMuted>
                    <View style={[styles.currentDesignValue, { borderColor: primary, backgroundColor: cardIconBg }]}>
                      <Text style={[styles.currentDesignText, { color: primary }]}>{designName}</Text>
                    </View>

                    <PanelMuted style={styles.sensorLine}>
                      Gyro: x {gyroData.x.toFixed(3)} · y {gyroData.y.toFixed(3)} · z {gyroData.z.toFixed(3)}{' '}
                      rad/s
                    </PanelMuted>
                    <PanelMuted style={styles.sensorLine}>
                      Accel: x {accelData.x.toFixed(2)} · y {accelData.y.toFixed(2)} · z{' '}
                      {accelData.z.toFixed(2)} g
                    </PanelMuted>
                    <PanelMuted style={styles.sensorLine}>Location: {locationStatus}</PanelMuted>
                  </>
                )}

                <View style={styles.panelButtons}>
                  <PrimaryButton
                    label={isActive ? 'Stop & record' : 'Start shaker test'}
                    variant={isActive ? 'danger' : 'primary'}
                    disabled={
                      Platform.OS === 'web' || (!isActive && attempts.length >= MAX_ATTEMPTS) || isSyncing
                    }
                    onPress={() => (isActive ? stopAttempt() : startAttempt())}
                  />
                  <PrimaryButton
                    label="Reset"
                    variant="secondary"
                    onPress={resetAll}
                    disabled={(time === 0 && attempts.length === 0) || isSyncing}
                  />
                  <PrimaryButton
                    label={isSyncing ? 'Syncing...' : 'Finish & save'}
                    variant="secondary"
                    onPress={() => void finishAndSave()}
                    disabled={attempts.length < MAX_ATTEMPTS || isActive || isSyncing}
                  />
                </View>

                <View style={styles.helperRow}>
                  <PanelMuted style={styles.helper}>
                    Attempts: {attempts.length}/{MAX_ATTEMPTS}
                  </PanelMuted>
                  <Text style={[styles.helperPeak, { color: primary }]}>
                    Best: {bestScore !== null ? `${bestScore} pts` : '—'}
                  </Text>
                </View>
              </ColorPanel>

              <ColorPanel colour="sky">
                <PanelTitle>Results</PanelTitle>
                {attempts.length === 0 ? (
                  <PanelMuted style={styles.placeholder}>No stability trials recorded yet.</PanelMuted>
                ) : (
                  <View style={styles.attemptsWrap}>
                    {attempts.map((attempt, index) => (
                      <AttemptRow
                        key={`${index}-${attempt.duration}`}
                        index={index + 1}
                        value={formatAttemptValue(attempt)}
                        isLast={index === attempts.length - 1}
                      />
                    ))}
                  </View>
                )}
              </ColorPanel>
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  listContainer: {
    gap: Spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  listItem: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
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
  panelButtons: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
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
    gap: Spacing.xs,
  },
  placeholder: {
    fontStyle: 'italic',
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