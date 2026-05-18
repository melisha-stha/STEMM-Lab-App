import { AttemptRow } from '@/components/ui/attempt-row';
import { Collapsible } from '@/components/ui/collapsible';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadEarthquakeResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

const ACTIVITY_EARTHQUAKE = 'earthquake';
const MAX_ATTEMPTS = 3;
const SENSOR_INTERVAL_MS = 100;
const TIMER_TICK_MS = 10;
const INITIAL_MIN_SCORE = 100;

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

/**
 * Derives a 0–100 stability score from gyroscope and accelerometer readings.
 * Higher score = less movement = more stable structure.
 */
const calculateStabilityScore = (gyro: SensorVector, accel: SensorVector): number => {
  const gyroMagnitude = Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2);
  const accelMagnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  const netAccel = Math.abs(accelMagnitude - 1);
  const movementIndex = gyroMagnitude * 0.6 + netAccel * 0.4;
  const score = Math.max(0, Math.min(100, 100 - movementIndex * 40));
  return Math.round(score);
};

/** Returns display colour for a stability score threshold band. */
const getStabilityColor = (score: number): string => {
  if (score >= 70) return '#2E7D32';
  if (score >= 40) return '#F57F17';
  return '#C62828';
};

/** Returns human-readable stability label for a score. */
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

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');

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
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Earthquake-Resistant Structure</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Run 1–3 stability trials. Higher score = more stable.
        </Text>
      </View>

      <SectionCard>
        <Collapsible title="Instructions">
          <View style={[styles.bullets, { borderTopColor: border }]}>
            <Text style={[styles.bullet, { color: mutedText }]}>
              • Place the phone on or against your structure before starting.
            </Text>
            <Text style={[styles.bullet, { color: mutedText }]}>
              • Gently shake the table to simulate an earthquake while recording.
            </Text>
            <Text style={[styles.bullet, { color: mutedText }]}>
              • Stop when the trial ends — your lowest stability score is saved.
            </Text>
            <Text style={[styles.bullet, { color: mutedText }]}>
              • Run up to 3 trials and compare which design scores highest.
            </Text>
          </View>
        </Collapsible>
      </SectionCard>

      <View style={[styles.instrumentPanel, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.panelLabel, { color: mutedText }]}>Stability Monitor</Text>

        {Platform.OS === 'web' ? (
          <Text style={[styles.webFallback, { color: mutedText }]}>
            Gyroscope and accelerometer are not available on web. Use a physical device to run
            this activity.
          </Text>
        ) : (
          <>
            <Text style={[styles.scoreValue, { color: stabilityColor }]}>{liveScore}</Text>
            <Text style={[styles.scoreLabel, { color: stabilityColor }]}>{stabilityLabel}</Text>
            <Text style={[styles.timerValue, { color: text }]}>{formatTime(time)}s</Text>
            <View style={styles.sensorDataRow}>
              <Text style={[styles.helper, { color: mutedText }]}>
                Gyro: x {gyroData.x.toFixed(3)} · y {gyroData.y.toFixed(3)} · z{' '}
                {gyroData.z.toFixed(3)} rad/s
              </Text>
            </View>
            <View style={styles.sensorDataRow}>
              <Text style={[styles.helper, { color: mutedText }]}>
                Accel: x {accelData.x.toFixed(2)} · y {accelData.y.toFixed(2)} · z{' '}
                {accelData.z.toFixed(2)} g
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
            label={isSyncing ? 'Syncing...' : 'Finish & Save'}
            variant="secondary"
            onPress={() => void finishAndSave()}
            disabled={attempts.length === 0 || isActive || isSyncing}
            style={{ borderColor: primary }}
          />
        </View>
        <View style={styles.helperRow}>
          <Text style={[styles.helper, { color: mutedText }]}>
            Attempts: {attempts.length}/{MAX_ATTEMPTS}
          </Text>
          <Text style={[styles.helper, { color: primary }]}>
            Best: {bestScore !== null ? `${bestScore} pts` : '—'}
          </Text>
        </View>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Results</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No stability trials recorded yet.
          </Text>
        ) : (
          <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
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
      </SectionCard>

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
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  instrumentPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg },
  panelLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  scoreValue: { marginTop: Spacing.sm, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreLabel: { ...Typography.section, fontSize: 16, marginTop: Spacing.xs },
  timerValue: { marginTop: Spacing.md, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  panelButtons: { marginTop: Spacing.md, gap: Spacing.sm },
  helperRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helper: { ...Typography.small },
  attemptsWrap: { borderTopWidth: 1, paddingTop: Spacing.xs },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  sensorDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    gap: 4,
  },
  webFallback: { ...Typography.body, fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
});
