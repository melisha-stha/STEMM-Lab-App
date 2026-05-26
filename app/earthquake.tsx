import { AttemptRow } from '@/components/ui/attempt-row';
import { Collapsible } from '@/components/ui/collapsible';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadEarthquakeResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

const ACTIVITY_EARTHQUAKE = 'earthquake';
const MAX_ATTEMPTS = 3;
const SENSOR_INTERVAL_MS = 100;
const TIMER_TICK_MS = 10;
const INITIAL_MIN_SCORE = 100;

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

interface SensorVector {
  x: number;
  y: number;
  z: number;
}

interface EarthquakeAttempt {
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

const calculateStabilityScore = (gyro: SensorVector, accel: SensorVector): number => {
  const gyroMagnitude = Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2);
  const accelMagnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  const netAccel = Math.abs(accelMagnitude - 1);
  const movementIndex = gyroMagnitude * 0.6 + netAccel * 0.4;
  const score = Math.max(0, Math.min(100, 100 - movementIndex * 40));
  return Math.round(score);
};

const getStabilityColor = (score: number): string => {
  if (score >= 70) return '#2E7D32';
  if (score >= 40) return '#F57F17';
  return '#C62828';
};

const getStabilityLabel = (score: number): string => {
  if (score >= 70) return 'Stable';
  if (score >= 40) return 'Moderate';
  return 'Unstable';
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

const formatAttemptValue = (attempt: EarthquakeAttempt): string =>
  `${attempt.score} pts · ${formatTime(attempt.duration)}s`;

export default function EarthquakeScreen() {
  const router = useRouter();

  // Tab Control Layout State
  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');

  // Core Sensors Engine and Stability States
  const [isActive, setIsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState<EarthquakeAttempt[]>([]);
  const [gyroData, setGyroData] = useState<SensorVector>(ZERO_VECTOR);
  const [accelData, setAccelData] = useState<SensorVector>(ZERO_VECTOR);
  const [liveScore, setLiveScore] = useState(INITIAL_MIN_SCORE);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const minScoreRef = useRef(INITIAL_MIN_SCORE);
  const gyroSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const accelSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  // Theme Layout Color Mappings
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  const onPrimary = useThemeColor({}, 'onPrimary' as any) ?? '#FFFFFF';

  const stabilityColor = getStabilityColor(liveScore);
  const stabilityLabel = getStabilityLabel(liveScore);
  const bestScore =
    attempts.length > 0 ? Math.max(...attempts.map((attempt) => attempt.score)) : null;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

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
    if (isActive && score < minScoreRef.current) {
      minScoreRef.current = score;
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  const stopSensors = (): void => {
    gyroSubscriptionRef.current?.remove();
    gyroSubscriptionRef.current = null;
    accelSubscriptionRef.current?.remove();
    accelSubscriptionRef.current = null;
  };

  const startAttempt = (): void => {
    setTime(0);
    timeRef.current = 0;
    minScoreRef.current = INITIAL_MIN_SCORE;
    setLiveScore(INITIAL_MIN_SCORE);
    setGyroData(ZERO_VECTOR);
    setAccelData(ZERO_VECTOR);
    setIsActive(true);
  };

  const stopAttempt = (): void => {
    setIsActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopSensors();

    const finalTime = timeRef.current;
    const minScore = minScoreRef.current;
    if (finalTime > 0 && attempts.length < MAX_ATTEMPTS) {
      setAttempts((prev) => [...prev, { score: minScore, duration: finalTime }]);
      setTime(0);
      timeRef.current = 0;
      minScoreRef.current = INITIAL_MIN_SCORE;
      setLiveScore(INITIAL_MIN_SCORE);
    }
  };

  const resetAll = (): void => {
    setIsActive(false);
    stopSensors();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTime(0);
    timeRef.current = 0;
    minScoreRef.current = INITIAL_MIN_SCORE;
    setLiveScore(INITIAL_MIN_SCORE);
    setAttempts([]);
    setGyroData(ZERO_VECTOR);
    setAccelData(ZERO_VECTOR);
  };

  const finishAndSave = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to save your results.');
      return;
    }
    if (attempts.length === 0) {
      Alert.alert('No attempts recorded', 'Please record at least one attempt before saving.');
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

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Earthquake-Resistant Structure</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Engineering + Earth Science</Text>
      </View>

      {/* Segmented Top Tab Controller Stack */}
      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isSelected = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[styles.tabPill, { backgroundColor: isSelected ? primary : card, borderColor: isSelected ? primary : border }]}
            >
              <Text style={[styles.tabPillText, { color: isSelected ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {screenTab === 'overview' && (
        <SectionCard>
          <Text style={[styles.sectionHeading, { color: text }]}>Overview</Text>
          <Text style={[styles.body, { color: text, lineHeight: 20 }]}>
            Students design structures that withstand vibration, simulating real-world tectonic earthquakes. Teams work inside a controlled design loop to find how material manipulation can isolate lateral energy.
          </Text>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <Text style={[styles.sectionHeading, { color: text }]}>Equipment</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: text }]}>• Cardboard, paper, scissors, sticky tape, plastic/paper cups.</Text>
            <Text style={[styles.listItem, { color: text }]}>• Mobile phone with vibration sensor</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <Text style={[styles.sectionHeading, { color: text }]}>Instructions</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>1. Build an anti-vibration layer, by folding paper/cardboard.</Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>2. Place a flat cardboard platform on top.</Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>3. Place the phone in the centre and activate vibration mode on the STEMM App.</Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>4. Modify the structure to reduce movement (e.g. more pillars, more folds, etc)</Text>
          </View>
        </SectionCard>
      )}

      {/* ==================== TAB 2: EXPERIMENT ==================== */}
      {screenTab === 'experiment' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Collapsible title="Quick Trial Checklists">
              <View style={[styles.bullets, { borderTopColor: border }]}>
                <Text style={[styles.bullet, { color: mutedText }]}>• Place the phone on or against your structure before starting.</Text>
                <Text style={[styles.bullet, { color: mutedText }]}>• Gently shake the table to simulate an earthquake while recording.</Text>
                <Text style={[styles.bullet, { color: mutedText }]}>• Stop when the trial ends — your lowest stability score is saved.</Text>
                <Text style={[styles.bullet, { color: mutedText }]}>• Run up to 3 trials and compare which design scores highest.</Text>
              </View>
            </Collapsible>
          </SectionCard>

          <View style={[styles.instrumentPanel, { borderColor: border, backgroundColor: card }]}>
            <Text style={[styles.panelLabel, { color: mutedText }]}>Stability Monitor</Text>

            {Platform.OS === 'web' ? (
              <Text style={[styles.webFallback, { color: mutedText }]}>
                Gyroscope and accelerometer are not available on web. Use a physical device to run this activity.
              </Text>
            ) : (
              <>
                <Text style={[styles.scoreValue, { color: stabilityColor }]}>{liveScore}</Text>
                <Text style={[styles.scoreLabel, { color: stabilityColor }]}>{stabilityLabel}</Text>
                <Text style={[styles.timerValue, { color: text }]}>{formatTime(time)}s</Text>
                
                <View style={styles.sensorDataRow}>
                  <Text style={[styles.helper, { color: mutedText }]}>
                    Gyro: x {gyroData.x.toFixed(3)} · y {gyroData.y.toFixed(3)} · z {gyroData.z.toFixed(3)} rad/s
                  </Text>
                </View>
                <View style={styles.sensorDataRow}>
                  <Text style={[styles.helper, { color: mutedText }]}>
                    Accel: x {accelData.x.toFixed(2)} · y {accelData.y.toFixed(2)} · z {accelData.z.toFixed(2)} g
                  </Text>
                </View>
                <View style={styles.sensorDataRow}>
                  <Text style={[styles.helper, { color: mutedText }]}>GPS Status: {locationStatus}</Text>
                </View>
              </>
            )}

            <View style={styles.panelButtons}>
              <PrimaryButton
                label={isActive ? 'Stop & record' : 'Start trial'}
                variant={isActive ? 'danger' : 'primary'}
                disabled={Platform.OS === 'web' || (!isActive && attempts.length >= MAX_ATTEMPTS) || isSyncing}
                onPress={() => (isActive ? stopAttempt() : startAttempt())}
              />
              <PrimaryButton
                label="Reset"
                variant="secondary"
                onPress={resetAll}
                disabled={(time === 0 && attempts.length === 0) || isSyncing}
              />
              <PrimaryButton
                label={isSyncing ? 'Syncing...' : 'Finish & Save'}
                variant="secondary"
                onPress={() => void finishAndSave()}
                disabled={attempts.length === 0 || isActive || isSyncing}
                style={{ borderColor: primary }}
              />
            </View>
            
            <View style={styles.helperRow}>
              <Text style={[styles.helper, { color: mutedText }]}>Attempts: {attempts.length}/{MAX_ATTEMPTS}</Text>
              <Text style={[styles.helper, { color: primary }]}>Best: {bestScore !== null ? `${bestScore} pts` : '—'}</Text>
            </View>
          </View>

          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Results</Text>
            {attempts.length === 0 ? (
              <Text style={[styles.placeholder, { color: mutedText }]}>No stability trials recorded yet.</Text>
            ) : (
              <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
                {attempts.map((attempt, index) => (
                  <AttemptRow key={`${index}-${attempt.duration}`} index={index + 1} value={formatAttemptValue(attempt)} isLast={index === attempts.length - 1} />
                ))}
              </View>
            )}
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 3: WRITE-UP ==================== */}
      {screenTab === 'writeup' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Write-up (on paper)</Text>
            <Text style={[styles.body, { color: mutedText, fontStyle: 'italic', marginBottom: Spacing.sm }]}>
              Answer these evaluation prompts on your physical printed lab sheets:
            </Text>

            <View style={styles.promptListContainer}>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Predict which fold design makes the phone move the least.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Record the structural results after manual shaking sequence loops.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Were your engineering predictions right upon live execution?</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Did you discover any structural surprises while shaking components?</Text>
            </View>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, marginBottom: Spacing.xs }]}>Data Entry Reference Table</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={[styles.matrixTableGrid, { borderColor: border }]}>
                <View style={[styles.matrixHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 180 }]}>Design Configuration</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 120 }]}>Phone Moves (cm)</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 140 }]}>Outcome (in degrees)</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 120 }]}>Were you right?</Text>
                </View>

                <View style={[styles.matrixDataRow, { borderBottomColor: border }]}>
                  <Text style={[styles.tableBodyCell, { color: text, fontWeight: '600', width: 180 }]}>Design 1 (4 folds + 4 pillars)</Text>
                  <Text style={[styles.tableBodyCell, { color: text, fontStyle: 'italic', width: 120 }]}>e.g. +/- 1cm</Text>
                  <Text style={[styles.tableBodyCell, { color: text, fontStyle: 'italic', width: 140 }]}>4cm</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, width: 120 }]}>[  ] Y / [  ] N</Text>
                </View>

                <View style={[styles.matrixDataRow, { borderBottomColor: border }]}>
                  <Text style={[styles.tableBodyCell, { color: text, fontWeight: '600', width: 180 }]}>Design 2 (10 folds + 4 pillars)</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 120 }]}>Fill on paper...</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 140 }]}>Fill on paper...</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, width: 120 }]}>[  ] Y / [  ] N</Text>
                </View>

                <View style={[styles.matrixDataRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.tableBodyCell, { color: text, fontWeight: '600', width: 180 }]}>Design 3 (3 folds + 6 pillars)</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 120 }]}>Fill on paper...</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 140 }]}>Fill on paper...</Text>
                  <Text style={[styles.tableBodyCell, { color: mutedText, width: 120 }]}>[  ] Y / [  ] N</Text>
                </View>
              </View>
            </ScrollView>
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 4: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Discussion</Text>
            <Text style={[styles.body, { color: text, lineHeight: 20 }]}>
              Earthquakes cause fast, destructive ground vibrations that can crack, snap, and collapse poorly designed structures. Structural engineers utilize specialized physics patterns to ensure buildings absorb, redirect, and distribute lateral kinetic energy safely.
            </Text>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, marginBottom: Spacing.xs }]}>Curriculum Links Reference</Text>
            <View style={styles.curriculumContainer}>
              <Text style={[styles.bullet, { color: text }]}>• ACSSU096 – Earth processes and tectonic shifting occurrences.</Text>
              <Text style={[styles.bullet, { color: text, marginTop: 4 }]}>• ACTDEP036 – Testing and iteratively improving designs with evidence variables.</Text>
            </View>
          </SectionCard>
        </View>
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
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.xs },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPillText: { ...Typography.small, fontWeight: '700' },
  sectionHeading: { ...Typography.section, fontSize: 16, fontWeight: '700', marginBottom: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 18 },
  divider: { height: 1, marginVertical: Spacing.md, opacity: 0.4 },
  listContainer: { gap: 6, marginTop: Spacing.xs },
  listItem: { ...Typography.body, fontSize: 13 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  instrumentPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg },
  panelLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  scoreValue: { marginTop: Spacing.sm, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreLabel: { ...Typography.section, fontSize: 16, marginTop: Spacing.xs },
  timerValue: { marginTop: Spacing.md, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  panelButtons: { marginTop: Spacing.md, gap: Spacing.sm },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  helper: { ...Typography.small },
  attemptsWrap: { borderTopWidth: 1, paddingTop: Spacing.xs },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  sensorDataRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, paddingHorizontal: Spacing.xs, gap: 4 },
  webFallback: { ...Typography.body, fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
  promptListContainer: { gap: 6, marginVertical: Spacing.xs },
  bulletPrompt: { ...Typography.body, fontSize: 13, lineHeight: 18 },
  bodyHeading: { ...Typography.section, fontSize: 14, marginTop: Spacing.xs },
  matrixTableGrid: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.xs },
  matrixHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: Spacing.sm },
  matrixDataRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: 'bold' },
  tableBodyCell: { ...Typography.small, fontSize: 12 },
  curriculumContainer: { gap: 4, marginTop: Spacing.xs },
});