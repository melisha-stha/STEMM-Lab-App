import { AttemptRow } from '@/components/ui/attempt-row';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import React, { useEffect, useState } from 'react';
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
import { auth } from '../hooks/firebaseConfig';
import { uploadParachuteResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

const GRAVITY = 9.8;
const MAX_ATTEMPTS = 3;

const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_PARACHUTE_UPLOAD';

TaskManager.defineTask(
  BACKGROUND_UPLOAD_TASK,
  async ({ data, error }: { data?: unknown; error?: unknown }) => {
    if (error) {
      console.error('Background task error:', error);
      return;
    }
    if (data) {
      try {
        const { userId, teamData, attempts, locationData } = data as {
          userId: string;
          teamData: unknown;
          attempts: { time: number; videoUri?: string }[];
          locationData: { latitude: number; longitude: number } | null;
        };
        await uploadParachuteResult(userId, teamData, attempts, locationData);
      } catch (err) {
        console.error('Background Sync Failed:', err);
      }
    }
  }
);

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';
type BounceMode = 'no_bounce' | 'bounced';

type ParachuteCalculations = {
  finalVelocity: number;
  acceleration: number;
  netForce: number;
  weight: number;
  dragForce: number;
};

type ParachuteAttempt = {
  dropTimeSec: number;
  contactTimeSec: number;
  bounced: boolean;
  bounceTimeSec: number | null;
  videoUri: string | null;
  calculations: ParachuteCalculations;
  gForce: number;
};

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

const WRITE_UP_TABLE_HEADERS = [
  '',
  'How long will it take to hit the ground?',
  'Time (first hit)',
  'Were you right?',
  'Time (first hit to stop — slow motion needed)',
] as const;

const WRITE_UP_TABLE_ROWS = [
  ['Action 1 (e.g. No parachute — baseline)', '', '', '', ''],
  ['Action 2 (e.g. Plastic with four corners tied to toy)', '', '', '', ''],
  ['Action 3', '', '', '', ''],
] as const;

const FORCES_TABLE_ROWS = [
  ['Downward (weight)', 'Weight = mass × g'],
  ['Upward (drag)', 'Drag force from the parachute'],
  ['Net (total) force', 'Net Force = Weight − Drag Force'],
] as const;

const G_FORCE_TABLE_ROWS = [
  ['1–5 g', 'Standing up quickly, elevators, amusement rides', 'No injury'],
  ['5–10 g', 'Hard falls while running, minor car braking', 'Possible bruising or strains'],
  [
    '10–30 g',
    'Sports collisions, bicycle crashes, car crashes with seatbelts',
    'Serious injuries possible (broken bones, concussions)',
  ],
  ['30–50 g', 'Severe car crashes, falls onto hard surfaces', 'High risk of severe injury'],
  ['50+ g', 'Very sudden stops with no cushioning', 'Life-threatening injuries likely'],
] as const;

type TableTheme = {
  text: string;
  mutedText: string;
  border: string;
  card: string;
  background: string;
};

const formatDropTimeSec = (sec: number): string => `${sec.toFixed(2)}s`;

const calculateParachutePhysics = (
  dropTimeSec: number,
  massKg: number,
  heightM: number
): ParachuteCalculations => {
  const finalVelocity = heightM / dropTimeSec;
  const acceleration = finalVelocity / dropTimeSec;
  const netForce = massKg * acceleration;
  const weight = massKg * GRAVITY;
  const dragForce = weight - netForce;

  return {
    finalVelocity: Math.round(finalVelocity * 100) / 100,
    acceleration: Math.round(acceleration * 100) / 100,
    netForce: Math.round(netForce * 1000) / 1000,
    weight: Math.round(weight * 1000) / 1000,
    dragForce: Math.round(dragForce * 1000) / 1000,
  };
};

const calculateGForceNoBounce = (
  finalVelocity: number,
  contactTimeSec: number
): number => {
  if (contactTimeSec <= 0) return 0;
  return Math.round((finalVelocity / contactTimeSec / GRAVITY) * 10) / 10;
};

const calculateGForceBounce = (
  finalVelocity: number,
  contactTimeSec: number,
  bounceTimeSec: number
): number => {
  if (contactTimeSec <= 0) return 0;
  const vUp = GRAVITY * bounceTimeSec;
  const deltaV = finalVelocity + vUp;
  return Math.round((deltaV / contactTimeSec / GRAVITY) * 10) / 10;
};

const getGForceColour = (gForce: number): string => {
  if (gForce <= 5) return '#2E7D32';
  if (gForce <= 10) return '#F57F17';
  if (gForce <= 30) return '#E53935';
  return '#B71C1C';
};

const renderDataTable = (
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  theme: TableTheme,
  options?: { scrollable?: boolean; columnWidths?: number[] }
): React.ReactElement => {
  const table = (
    <View
      style={[
        styles.table,
        { borderColor: theme.border },
        options?.scrollable
          ? {
              minWidth:
                options.columnWidths?.reduce((sum, w) => sum + w, 0) ?? 640,
            }
          : null,
      ]}>
      <View
        style={[
          styles.tableHeaderRow,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}>
        {headers.map((header, index) => (
          <Text
            key={`header-${index}`}
            style={[
              styles.tableHeaderCell,
              options?.columnWidths?.[index] != null
                ? { width: options.columnWidths[index] }
                : index === 0
                  ? styles.tableColNarrow
                  : styles.tableColFlex,
              { color: theme.text },
            ]}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[
            styles.tableRow,
            {
              backgroundColor: rowIndex % 2 === 0 ? theme.background : theme.card,
              borderBottomColor: theme.border,
              borderBottomWidth: rowIndex < rows.length - 1 ? 1 : 0,
            },
          ]}>
          {row.map((cell, cellIndex) => (
            <Text
              key={`cell-${rowIndex}-${cellIndex}`}
              style={[
                styles.tableCell,
                options?.columnWidths?.[cellIndex] != null
                  ? { width: options.columnWidths[cellIndex] }
                  : cellIndex === 0
                    ? styles.tableColNarrow
                    : styles.tableColFlex,
                { color: cellIndex === 0 ? theme.text : theme.mutedText },
                cellIndex === 0 ? { fontWeight: '700' } : null,
              ]}>
              {cell || ' '}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );

  if (options?.scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator>
        {table}
      </ScrollView>
    );
  }

  return table;
};

export default function ParachuteScreen() {
  const router = useRouter();

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attempts, setAttempts] = useState<ParachuteAttempt[]>([]);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  const [massKg, setMassKg] = useState<string>('');
  const [heightM, setHeightM] = useState<string>('');

  const [currentVideoUri, setCurrentVideoUri] = useState<string | null>(null);
  const [dropTimeSec, setDropTimeSec] = useState<string>('');
  const [contactTimeSec, setContactTimeSec] = useState<string>('');
  const [bounceMode, setBounceMode] = useState<BounceMode>('no_bounce');
  const [bounceTimeSec, setBounceTimeSec] = useState<string>('');
  const [currentCalculations, setCurrentCalculations] = useState<ParachuteCalculations | null>(
    null
  );
  const [currentGForce, setCurrentGForce] = useState<number | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const tableTheme: TableTheme = { text, mutedText, border, card, background };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

  const hasUnsavedAttempt =
    currentVideoUri !== null ||
    dropTimeSec.trim().length > 0 ||
    contactTimeSec.trim().length > 0 ||
    currentCalculations !== null;

  const resetCurrentAttempt = (): void => {
    setCurrentVideoUri(null);
    setDropTimeSec('');
    setContactTimeSec('');
    setBounceTimeSec('');
    setBounceMode('no_bounce');
    setCurrentCalculations(null);
    setCurrentGForce(null);
  };

  const recordDrop = async (): Promise<void> => {
    if (attemptCount >= MAX_ATTEMPTS || isSyncing || hasUnsavedAttempt) return;

    setIsRecording(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 30,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setCurrentVideoUri(result.assets[0].uri);
        setDropTimeSec('');
        setContactTimeSec('');
        setBounceTimeSec('');
        setBounceMode('no_bounce');
        setCurrentCalculations(null);
        setCurrentGForce(null);
      }
    } finally {
      setIsRecording(false);
    }
  };

  const calculatePhysics = (): void => {
    const mass = parseFloat(massKg);
    const height = parseFloat(heightM);
    const dropTime = parseFloat(dropTimeSec);
    const contactTime = parseFloat(contactTimeSec);

    if (!mass || !height || !dropTime || !contactTime) {
      Alert.alert('Please fill in all required fields');
      return;
    }

    const calcs = calculateParachutePhysics(dropTime, mass, height);
    setCurrentCalculations(calcs);

    let gForce: number;
    if (bounceMode === 'no_bounce') {
      gForce = calculateGForceNoBounce(calcs.finalVelocity, contactTime);
    } else {
      const bounceTime = parseFloat(bounceTimeSec) || 0;
      gForce = calculateGForceBounce(calcs.finalVelocity, contactTime, bounceTime);
    }
    setCurrentGForce(gForce);
  };

  const saveAttempt = (): void => {
    if (!currentCalculations || currentGForce === null) {
      Alert.alert('Calculate physics first');
      return;
    }

    const newAttempt: ParachuteAttempt = {
      dropTimeSec: parseFloat(dropTimeSec),
      contactTimeSec: parseFloat(contactTimeSec),
      bounced: bounceMode === 'bounced',
      bounceTimeSec: bounceMode === 'bounced' ? parseFloat(bounceTimeSec) : null,
      videoUri: currentVideoUri,
      calculations: currentCalculations,
      gForce: currentGForce,
    };

    const updated = [...attempts, newAttempt];
    setAttempts(updated);
    setAttemptCount(updated.length);
    resetCurrentAttempt();
  };

  const finishAndViewResults = async (): Promise<void> => {
    if (!attempts.length) return;
    const user = auth.currentUser;
    if (!user) return;

    setIsSyncing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationData: { latitude: number; longitude: number } | null = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }

      const massNum = Number(massKg);
      const heightNum = Number(heightM);
      const hasPhysicsInputs =
        massKg.trim().length > 0 &&
        heightM.trim().length > 0 &&
        Number.isFinite(massNum) &&
        Number.isFinite(heightNum);

      const bestAttempt = attempts.reduce((best, attempt) =>
        attempt.dropTimeSec > best.dropTimeSec ? attempt : best
      );

      const sanitizedAttempts = attempts.map((attempt) => {
        const base = {
          time: Math.round(attempt.dropTimeSec * 1000),
          videoUri: attempt.videoUri || '',
          dropTimeSec: attempt.dropTimeSec,
          contactTimeSec: attempt.contactTimeSec,
          bounced: attempt.bounced,
          bounceTimeSec: attempt.bounceTimeSec,
          calculations: attempt.calculations,
          gForce: attempt.gForce,
        } as {
          time: number;
          videoUri: string;
          dropTimeSec: number;
          contactTimeSec: number;
          bounced: boolean;
          bounceTimeSec: number | null;
          calculations: ParachuteCalculations;
          gForce: number;
          massKg?: number;
          heightM?: number;
        };
        if (hasPhysicsInputs) {
          base.massKg = massNum;
          base.heightM = heightNum;
        }
        return base;
      });

      const teamData = await getTeamData();

      await Promise.all([
        uploadParachuteResult(user.uid, teamData, sanitizedAttempts, locationData),
        Promise.resolve(
          insertTrial(
            teamData?.name || 'unknown',
            'parachute',
            Math.round(bestAttempt.dropTimeSec * 1000),
            bestAttempt.videoUri || '',
            locationData?.latitude ?? null,
            locationData?.longitude ?? null
          )
        ),
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Trial data for ${teamData?.name || 'your team'} has been saved to the cloud!`,
          data: { screen: 'results' },
        },
        trigger: null,
      });

      router.push('/results');
    } catch (error) {
      console.error('Sync Error:', error);
      Alert.alert('Sync Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const renderOverviewTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.heroTitle, { color: text }]}>Parachute Drop Challenge</Text>
      <Text style={[styles.heroSubtitle, { color: mutedText }]}>Engineering + Physics</Text>
      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Students design, build, and test a parachute for a small toy to reduce its landing speed and
        impact force. Teams iterate their designs under time and material constraints, aiming to
        achieve the slowest and safest landing within a target area.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Mobile phone with STEMM Lab app</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Small toy (e.g. army toy soldier)</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Table or elevated surface</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Paper or plastic</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• String</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Scissors</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Tape</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>
          1. Drop the toy without a parachute and record the fall (baseline test)
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          2. Build a parachute using provided materials
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          3. Drop the toy from the same height and record the fall
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          4. Review speed and landing accuracy results in the app
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          5. Redesign and test up to three prototypes within 20 minutes
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          6. Upload videos, results, and team reflections
        </Text>
      </View>

      <View style={[styles.diagramCard, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.diagramText, { color: mutedText }]}>
          [Diagram: Toy attached to parachute, drop height marked, target landing zone shown on floor]
        </Text>
      </View>
    </SectionCard>
  );

  const renderExperimentTab = (): React.ReactElement => {
    const massNum = Number(massKg);
    const heightNum = Number(heightM);
    const hasInputs =
      massKg.trim().length > 0 &&
      heightM.trim().length > 0 &&
      Number.isFinite(massNum) &&
      Number.isFinite(heightNum) &&
      massNum > 0 &&
      heightNum > 0;

    const showCurrentAttempt =
      Platform.OS === 'web' ? attemptCount < MAX_ATTEMPTS : currentVideoUri !== null;

    const canCalculate =
      hasInputs &&
      dropTimeSec.trim().length > 0 &&
      contactTimeSec.trim().length > 0 &&
      (bounceMode === 'no_bounce' || bounceTimeSec.trim().length > 0);

    const bestDropTime =
      attempts.length > 0
        ? Math.max(...attempts.map((attempt) => attempt.dropTimeSec))
        : null;

    return (
      <View style={styles.experimentWrap}>
        <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.body, { color: mutedText }]}>
            Position phone to capture the full drop from release to landing. Use slow-motion mode
            for impact analysis.
          </Text>
        </View>

        <Input
          label="Mass of toy (kg)"
          placeholder="e.g. 0.20"
          value={massKg}
          onChangeText={setMassKg}
          keyboardType="decimal-pad"
        />
        <Input
          label="Height of table (m)"
          placeholder="e.g. 1.0"
          value={heightM}
          onChangeText={setHeightM}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.note, { color: mutedText }]}>Required for force and G-force calculations</Text>

        <View style={[styles.experimentPanel, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.experimentLabel, { color: mutedText }]}>Experiment</Text>
          <View style={styles.sensorDataRow}>
            <Text style={[styles.helper, { color: mutedText }]}>GPS Status: {locationStatus}</Text>
          </View>
          <Text style={[styles.helper, { color: text, marginTop: Spacing.sm, fontWeight: '700' }]}>
            Attempt {Math.min(attemptCount + 1, MAX_ATTEMPTS)} of {MAX_ATTEMPTS}
          </Text>

          {Platform.OS === 'web' ? (
            <Text style={[styles.note, { color: mutedText, marginBottom: Spacing.sm }]}>
              Camera not available on web. Enter drop time manually.
            </Text>
          ) : (
            <PrimaryButton
              label={isRecording ? 'Recording...' : 'Record Drop'}
              variant="primary"
              disabled={
                attemptCount >= MAX_ATTEMPTS ||
                isSyncing ||
                isRecording ||
                hasUnsavedAttempt
              }
              onPress={() => void recordDrop()}
              style={{ marginTop: Spacing.sm }}
            />
          )}

          <View style={styles.timerButtons}>
            <PrimaryButton
              label={isSyncing ? 'Syncing...' : 'Finish & Save'}
              variant="secondary"
              onPress={() => void finishAndViewResults()}
              disabled={
                attemptCount === 0 || hasUnsavedAttempt || isRecording || isSyncing
              }
              style={{ borderColor: primary, marginTop: Spacing.sm }}
            />
          </View>

          <View style={styles.helperRow}>
            <Text style={[styles.helper, { color: mutedText }]}>
              Saved: {attemptCount}/{MAX_ATTEMPTS}
            </Text>
            <Text style={[styles.helper, { color: primary }]}>
              Best: {bestDropTime != null ? formatDropTimeSec(bestDropTime) : '—'}
            </Text>
          </View>
        </View>

        {showCurrentAttempt ? (
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Current Attempt
            </Text>

            {currentVideoUri ? (
              <Video
                source={{ uri: currentVideoUri }}
                style={styles.videoPlayer}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
              />
            ) : null}

            <View style={[styles.infoCard, { borderColor: border, backgroundColor: card, marginTop: Spacing.sm }]}>
              <Text style={[styles.body, { color: mutedText }]}>
                Review your slow-motion video carefully:{'\n'}
                1. Find the moment the toy was released — this is time 0{'\n'}
                2. Find the moment the toy first hits the ground — this is your drop time{'\n'}
                3. Find the moment the toy stops moving — subtract first contact to get contact time
              </Text>
            </View>

            <Input
              label="Drop time (s)"
              placeholder="e.g. 0.85"
              hint="Time from release to first ground contact"
              value={dropTimeSec}
              onChangeText={(value) => {
                setDropTimeSec(value);
                setCurrentCalculations(null);
                setCurrentGForce(null);
              }}
              keyboardType="decimal-pad"
              style={{ marginTop: Spacing.sm }}
            />
            <Input
              label="Contact time (s)"
              placeholder="e.g. 0.05"
              hint="Time from first contact to toy stopping"
              value={contactTimeSec}
              onChangeText={(value) => {
                setContactTimeSec(value);
                setCurrentCalculations(null);
                setCurrentGForce(null);
              }}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.sm }]}>
              Did the toy bounce?
            </Text>
            <View style={styles.bounceRow}>
              <Pressable
                onPress={() => {
                  setBounceMode('no_bounce');
                  setCurrentCalculations(null);
                  setCurrentGForce(null);
                }}
                style={[
                  styles.bouncePill,
                  {
                    backgroundColor: bounceMode === 'no_bounce' ? primary : card,
                    borderColor: bounceMode === 'no_bounce' ? primary : border,
                  },
                ]}>
                <Text
                  style={[
                    styles.bouncePillText,
                    { color: bounceMode === 'no_bounce' ? onPrimary : text },
                  ]}>
                  No Bounce
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setBounceMode('bounced');
                  setCurrentCalculations(null);
                  setCurrentGForce(null);
                }}
                style={[
                  styles.bouncePill,
                  {
                    backgroundColor: bounceMode === 'bounced' ? primary : card,
                    borderColor: bounceMode === 'bounced' ? primary : border,
                  },
                ]}>
                <Text
                  style={[
                    styles.bouncePillText,
                    { color: bounceMode === 'bounced' ? onPrimary : text },
                  ]}>
                  Bounced
                </Text>
              </Pressable>
            </View>

            {bounceMode === 'bounced' ? (
              <Input
                label="Bounce time (s)"
                placeholder="e.g. 0.15"
                hint="Time from first contact to max bounce height"
                value={bounceTimeSec}
                onChangeText={(value) => {
                  setBounceTimeSec(value);
                  setCurrentCalculations(null);
                  setCurrentGForce(null);
                }}
                keyboardType="decimal-pad"
                style={{ marginTop: Spacing.sm }}
              />
            ) : null}

            <PrimaryButton
              label="Calculate Physics"
              variant="primary"
              disabled={!canCalculate || isSyncing}
              onPress={calculatePhysics}
              style={{ marginTop: Spacing.sm }}
            />

            {currentCalculations && currentGForce !== null ? (
              <SectionCard>
                <Text style={[styles.sectionTitle, { color: text }]}>Calculations</Text>
                <View style={[styles.calcList, { borderTopColor: border }]}>
                  <Text style={[styles.calcRow, { color: mutedText }]}>
                    Final Velocity: {currentCalculations.finalVelocity} m/s
                  </Text>
                  <Text style={[styles.calcRow, { color: mutedText }]}>
                    Acceleration: {currentCalculations.acceleration} m/s²
                  </Text>
                  <Text style={[styles.calcRow, { color: mutedText }]}>
                    Weight: {currentCalculations.weight} N
                  </Text>
                  <Text style={[styles.calcRow, { color: mutedText }]}>
                    Net Force: {currentCalculations.netForce} N
                  </Text>
                  <Text style={[styles.calcRow, { color: mutedText }]}>
                    Drag Force: {currentCalculations.dragForce} N
                  </Text>
                </View>
                <Text style={[styles.gForceValue, { color: getGForceColour(currentGForce) }]}>
                  G-Force: {currentGForce} g
                </Text>
                <PrimaryButton
                  label="Save Attempt"
                  variant="secondary"
                  disabled={attemptCount >= MAX_ATTEMPTS || isSyncing}
                  onPress={saveAttempt}
                  style={{ marginTop: Spacing.sm, borderColor: primary }}
                />
              </SectionCard>
            ) : null}
          </SectionCard>
        ) : null}

        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Saved Attempts</Text>
          {attempts.length === 0 ? (
            <Text style={[styles.placeholder, { color: mutedText }]}>No drops saved yet.</Text>
          ) : (
            <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
              {attempts.map((attempt, i) => (
                <View key={i} style={styles.attemptBlock}>
                  <AttemptRow
                    index={i + 1}
                    value={formatDropTimeSec(attempt.dropTimeSec)}
                    isLast={i === attempts.length - 1}
                  />
                  {attempt.videoUri ? (
                    <Video
                      source={{ uri: attempt.videoUri }}
                      style={styles.videoPlayer}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={false}
                    />
                  ) : null}
                  <View style={[styles.calcList, { borderTopColor: border }]}>
                    <Text style={[styles.calcRow, { color: mutedText }]}>
                      Contact time: {attempt.contactTimeSec}s
                      {attempt.bounced && attempt.bounceTimeSec != null
                        ? ` · Bounce: ${attempt.bounceTimeSec}s`
                        : ''}
                    </Text>
                    <Text style={[styles.calcRow, { color: mutedText }]}>
                      Final Velocity: {attempt.calculations.finalVelocity} m/s
                    </Text>
                    <Text style={[styles.calcRow, { color: mutedText }]}>
                      G-Force: {attempt.gForce} g
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      </View>
    );
  };

  const renderWriteupTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Write-up Template</Text>
      <Text style={[styles.body, { color: mutedText }]}>Use this as a reference for your paper write-up</Text>

      <Text style={[styles.italic, { color: mutedText, marginTop: Spacing.sm }]}>Predict which parachute design was the best.</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Sketch each design (on paper)</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Record the times of each design</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Were you correct in your timings?</Text>
      <Text style={[styles.italic, { color: mutedText }]}>What design was the easiest to make?</Text>

      <View style={{ marginTop: Spacing.md }}>
        {renderDataTable(WRITE_UP_TABLE_HEADERS, WRITE_UP_TABLE_ROWS, tableTheme, {
          scrollable: true,
          columnWidths: [160, 190, 120, 110, 240],
        })}
      </View>
      <Text style={[styles.note, { color: mutedText }]}>
        All cells are for paper use — fill these in during your experiment
      </Text>
    </SectionCard>
  );

  const renderDiscussionTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Discussion: Parachutes and Forces</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Gravity pulls objects downward, causing them to speed up as they fall. A parachute increases air resistance (also called drag). Drag acts upward, opposing the motion and slowing the fall. A slower fall reduces the force when the toy hits the ground, making the landing safer. Engineers improve parachute designs through repeated testing and redesign.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Forces Acting on the Toy</Text>
      {renderDataTable(['Force', 'Formula'], FORCES_TABLE_ROWS, tableTheme)}
      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Newton&apos;s Second Law: Net Force = mass × acceleration
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>G-Force and Injury Risk</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        G-force describes how quickly the object slows down on impact. It is measured in multiples of g = 9.8 m/s². The goal is to design a parachute that reduces G-force to as close to 1 g as possible.
      </Text>

      <View style={{ marginTop: Spacing.sm }}>
        {renderDataTable(['G-Force Range', 'Examples', 'Likely Effects'], G_FORCE_TABLE_ROWS, tableTheme, {
          columnWidths: [88, 170, 190],
        })}
      </View>

      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Important: Duration matters. A brief spike can be survivable, while sustained g-forces are more dangerous.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Student Focus</Text>
      <View style={styles.focusWrap}>
        <View style={[styles.focusCard, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.focusTitle, { color: text }]}>Primary School</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Measure time</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Calculate final speed</Text>
        </View>
        <View style={[styles.focusCard, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.focusTitle, { color: text }]}>High School</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Calculate final velocity</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Calculate acceleration</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Calculate net force</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Calculate drag force</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>• Calculate g-force</Text>
        </View>
      </View>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Curriculum Links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>Science:</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACSSU076 / ACSSU117 — Forces affect motion</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACSIS124 — Planning and conducting investigations</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACSIS126 — Analysing patterns in data</Text>
        <Text style={[styles.bullet, { color: mutedText, marginTop: Spacing.xs }]}>Design & Technologies:</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACTDEP036 — Generate, test, and improve solutions</Text>
        <Text style={[styles.bullet, { color: mutedText, marginTop: Spacing.xs }]}>Mathematics:</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACMMG108 — Measuring speed</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACMSP147 — Comparing data and averages</Text>
      </View>
    </SectionCard>
  );

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isActiveTab = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActiveTab ? primary : card,
                  borderColor: isActiveTab ? primary : border,
                },
              ]}>
              <Text style={[styles.tabPillText, { color: isActiveTab ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'overview' ? renderOverviewTab() : null}
      {screenTab === 'experiment' ? renderExperimentTab() : null}
      {screenTab === 'writeup' ? renderWriteupTab() : null}
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
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },

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

  heroTitle: { ...Typography.hero, fontSize: 26 },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body },

  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bodyHeading: { ...Typography.section, fontSize: 14 },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  italic: { ...Typography.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  note: { ...Typography.small, marginTop: Spacing.sm, lineHeight: 18 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },

  diagramCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  diagramText: { ...Typography.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },

  experimentWrap: { gap: Spacing.md },
  infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },

  experimentPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg },
  experimentLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  timerButtons: { marginTop: Spacing.md, gap: Spacing.sm },
  helperRow: { marginTop: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helper: { ...Typography.small },
  attemptsWrap: { borderTopWidth: 1, paddingTop: Spacing.xs, gap: Spacing.sm },
  attemptBlock: { gap: Spacing.sm },
  videoPlayer: { width: '100%', height: 200, borderRadius: Radius.lg },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  sensorDataRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, paddingHorizontal: Spacing.xs, gap: 4 },

  calcList: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  calcRow: { ...Typography.body, fontSize: 13 },

  bounceRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  bouncePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  bouncePillText: { ...Typography.small, fontWeight: '700' },
  gForceValue: { marginTop: Spacing.sm, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },

  focusWrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  focusCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 6 },
  focusTitle: { ...Typography.section, fontSize: 14 },

  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
  tableColNarrow: { width: 120 },
  tableColFlex: { flex: 1 },
});

