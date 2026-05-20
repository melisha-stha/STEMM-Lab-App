import { AttemptRow } from '@/components/ui/attempt-row';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import React, { useEffect, useRef, useState } from 'react';
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

const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_PARACHUTE_UPLOAD';

TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async ({ data, error }: { data?: unknown; error?: unknown }) => {
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
});

type ScreenTab = 'instructions' | 'writeup' | 'discussion' | 'calculations';

const SCREEN_TABS: ScreenTab[] = ['instructions', 'writeup', 'discussion', 'calculations'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  instructions: 'Instructions',
  writeup: 'Write-up',
  discussion: 'Discussion',
  calculations: 'Calculations',
};

const WRITE_UP_TABLE_HEADERS = [
  '',
  'How long will it take to hit the ground?',
  'Time (first hit)',
  'Were you right?',
  'Time (first hit to stop moving — slow motion)',
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
  ['10–30 g', 'Sports collisions, bicycle crashes, car crashes with seatbelts', 'Serious injuries possible'],
  ['30–50 g', 'Severe car crashes, falls onto hard surfaces', 'High risk of severe injury'],
  ['50+ g', 'Very sudden stops with no cushioning', 'Life-threatening injuries likely'],
] as const;

const G_FORCE_SUMMARY_ROWS = [
  ['No bounce', 'g = v_impact ÷ t_contact ÷ 9.8'],
  ['Bounce', 'g = (v_impact + v_up) ÷ t_contact ÷ 9.8'],
] as const;

type TableTheme = {
  text: string;
  mutedText: string;
  border: string;
  card: string;
  background: string;
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
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
        options?.scrollable ? { minWidth: options.columnWidths?.reduce((sum, w) => sum + w, 0) ?? 640 } : null,
      ]}>
      <View style={[styles.tableHeaderRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
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

  const [screenTab, setScreenTab] = useState<ScreenTab>('instructions');
  const [isActive, setIsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [time, setTime] = useState(0);
  const [attempts, setAttempts] = useState<{ time: number; videoUri?: string }[]>([]);
  const [subscription, setSubscription] = useState<{ remove: () => void } | null>(null);
  const [liveForce, setLiveForce] = useState(1.0);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  const [massKg, setMassKg] = useState('');
  const [heightM, setHeightM] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);

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

  const startAccelerometer = (): void => {
    if (Platform.OS === 'web') return;
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener((data) => {
      const force = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      setLiveForce(force);
      if (force > 2.5 && timeRef.current > 500) {
        stopAttempt();
      }
    });
    setSubscription(sub);
  };

  const stopAccelerometer = (): void => {
    subscription?.remove();
    setSubscription(null);
  };

  const startAttempt = (): void => {
    setTime(0);
    setIsActive(true);
    startAccelerometer();
  };

  const recordVideo = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      return result.assets[0].uri;
    }
    return null;
  };

  const stopAttempt = async (): Promise<void> => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopAccelerometer();

    const finalTime = timeRef.current;
    if (finalTime > 0 && attempts.length < 3) {
      setAttempts((prev) => [...prev, { time: finalTime, videoUri: '' }]);
      setTime(0);
      timeRef.current = 0;

      const videoLink = await recordVideo();
      if (videoLink) {
        setAttempts((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].videoUri = videoLink;
          return updated;
        });
      }
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime((prev) => {
          const newTime = prev + 10;
          timeRef.current = newTime;
          return newTime;
        });
      }, 10);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAccelerometer();
    };
  }, [isActive]);

  const resetAll = (): void => {
    setIsActive(false);
    stopAccelerometer();
    setTime(0);
    timeRef.current = 0;
    setAttempts([]);
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
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      const sanitizedAttempts = attempts.map((attempt) => ({
        time: attempt.time || 0,
        videoUri: attempt.videoUri || '',
      }));

      const teamData = await getTeamData();

      await Promise.all([
        uploadParachuteResult(user.uid, teamData, sanitizedAttempts, locationData),
        Promise.resolve(
          insertTrial(
            teamData?.name || 'unknown',
            'parachute',
            Math.min(...sanitizedAttempts.map((a) => a.time)),
            sanitizedAttempts[sanitizedAttempts.length - 1].videoUri || '',
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

  const renderInstructionsTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Parachute Drop Challenge</Text>
      <Text style={[styles.subheading, { color: mutedText }]}>Engineering + Physics</Text>

      <Text style={[styles.bodyHeading, { color: text }]}>Overview</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Students design, build, and test a parachute for a small toy to reduce its landing speed and
        impact force. Teams iterate their designs under time and material constraints, aiming to
        achieve the slowest and safest landing within a target area.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Mobile phone with STEMM Lab app</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Small toy (e.g. army toy soldier)</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Table or elevated surface</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Paper or plastic</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• String</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Scissors</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Tape</Text>
      </View>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
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

      <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.infoCardTitle, { color: text }]}>Setup diagram</Text>
        <Text style={[styles.body, { color: mutedText }]}>
          Setup: Place phone at a position to capture the full drop. Toy with parachute drops from
          table height. Phone records the fall.
        </Text>
      </View>
    </SectionCard>
  );

  const renderWriteupTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Write-up reference</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Predict which parachute design was the best.</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Sketch each design (on paper)</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Record the times of each design</Text>
      <Text style={[styles.italic, { color: mutedText }]}>Were you correct in your timings?</Text>
      <Text style={[styles.italic, { color: mutedText }]}>What design was the easiest to make?</Text>

      <View style={{ marginTop: Spacing.md }}>
        {renderDataTable(WRITE_UP_TABLE_HEADERS, WRITE_UP_TABLE_ROWS, tableTheme, {
          scrollable: true,
          columnWidths: [140, 160, 100, 90, 200],
        })}
      </View>

      <Input
        label="Mass of toy (kg)"
        placeholder="e.g. 0.20"
        value={massKg}
        onChangeText={setMassKg}
        keyboardType="decimal-pad"
        style={{ marginTop: Spacing.md }}
      />
      <Input
        label="Height of table (m)"
        placeholder="e.g. 1.0"
        value={heightM}
        onChangeText={setHeightM}
        keyboardType="decimal-pad"
      />
      <Text style={[styles.note, { color: mutedText }]}>
        Enter these values before saving results to enable force calculations.
      </Text>
    </SectionCard>
  );

  const renderDiscussionTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Discussion: Parachutes and Forces</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Gravity pulls objects downward, causing them to speed up as they fall. A parachute increases
        air resistance (also called drag). Drag acts upward, opposing the motion and slowing the fall.
        A slower fall reduces the force when the toy hits the ground, making the landing safer.
        Engineers improve parachute designs through repeated testing and redesign.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Forces Acting on the Toy
      </Text>
      {renderDataTable(['Force', 'Formula'], FORCES_TABLE_ROWS, tableTheme)}

      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Newton&apos;s Second Law: Net Force = mass × acceleration
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        G-Force and Injury Risk
      </Text>
      <Text style={[styles.body, { color: mutedText }]}>
        G-force describes how quickly the object slows down on impact. The goal is to design a
        parachute that reduces G-force to as close to 1 g as possible.
      </Text>

      <View style={{ marginTop: Spacing.sm }}>
        {renderDataTable(
          ['G-Force Range', 'Examples', 'Likely Effects'],
          G_FORCE_TABLE_ROWS,
          tableTheme,
          { columnWidths: [88, 160, 160] }
        )}
      </View>

      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Important: Duration matters. A brief spike can be survivable, while sustained g-forces are
        more dangerous.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Curriculum links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Science: ACSSU076 / ACSSU117 — Forces affect motion
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Science: ACSIS124 — Planning and conducting investigations
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Design & Technologies: ACTDEP036 — Generate, test, and improve solutions
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Mathematics: ACMMG108 — Measuring speed
        </Text>
      </View>
    </SectionCard>
  );

  const renderCalculationsTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Calculations</Text>

      <Text style={[styles.bodyHeading, { color: text }]}>Step 1: Measure the Drop Height</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Measure the height of the table or drop surface (distance fallen).
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Step 2: Measure the Time
      </Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Drop the toy (do not throw it). Record the time taken to first hit the ground using a phone
        timer or video.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Step 3: Calculate Final Velocity
      </Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Since the toy is dropped, the initial velocity is 0 m/s.
      </Text>
      <Text style={[styles.formula, { color: text }]}>Final velocity = distance ÷ time</Text>
      <Text style={[styles.body, { color: mutedText }]}>Example: 1.0 m ÷ 0.5 s = 2.0 m/s</Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Step 4: Calculate Acceleration
      </Text>
      <Text style={[styles.formula, { color: text }]}>Acceleration = Final velocity ÷ time</Text>
      <Text style={[styles.body, { color: mutedText }]}>Example: 2.0 ÷ 0.5 = 4.0 m/s²</Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Step 5: Calculate Net Force
      </Text>
      <Text style={[styles.formula, { color: text }]}>Net Force = mass × acceleration</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Example (mass = 0.20 kg): Net Force = 0.20 × 4.0 = 0.8 N
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Step 6: Calculate Drag Force
      </Text>
      <Text style={[styles.body, { color: mutedText }]}>Weight = mass × g = 0.20 × 9.8 = 1.96 N</Text>
      <Text style={[styles.body, { color: mutedText }]}>Drag Force = Weight − Net Force = 1.96 − 0.8 = 1.16 N</Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        G-Force Calculation
      </Text>
      <Text style={[styles.bodyHeading, { color: text }]}>Case 1 — Object Does Not Bounce:</Text>
      <Text style={[styles.formula, { color: text }]}>g-force = v_impact ÷ t_contact ÷ 9.8</Text>
      <Text style={[styles.body, { color: mutedText }]}>Example: 2.0 ÷ 0.05 ÷ 9.8 ≈ 4.1 g</Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.sm }]}>
        Case 2 — Object Bounces:
      </Text>
      <Text style={[styles.formula, { color: text }]}>g-force = (v_impact + v_up) ÷ t_contact ÷ 9.8</Text>
      <Text style={[styles.body, { color: mutedText }]}>v_up = g × t_up</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Example: impact 2.0 m/s, t_up = 0.15 s → v_up = 1.47 m/s
      </Text>
      <Text style={[styles.body, { color: mutedText }]}>
        g-force = (2.0 + 1.47) ÷ 0.02 ÷ 9.8 ≈ 17.7 g
      </Text>

      <View style={{ marginTop: Spacing.sm }}>
        {renderDataTable(['Case', 'g-force formula'], G_FORCE_SUMMARY_ROWS, tableTheme)}
      </View>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>
        Tips for slow-motion video
      </Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Use a ruler in frame for scale</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          • Identify first contact for contact time
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          • Identify when object leaves surface for bounce calculation
        </Text>
      </View>

      <View style={[styles.infoCard, { borderColor: border, backgroundColor: card, marginTop: Spacing.md }]}>
        <Text style={[styles.infoCardTitle, { color: text }]}>Student focus</Text>
        <Text style={[styles.body, { color: mutedText }]}>
          Primary School: measure time and calculate final speed.{'\n'}
          High School: calculate final velocity, acceleration, net force, drag force, and g-force.
        </Text>
      </View>
    </SectionCard>
  );

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Parachute Drop Challenge</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Engineering + Physics</Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Activity</Text>
        <View style={[styles.timerPanel, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.timerLabel, { color: mutedText }]}>Timer</Text>
          <Text style={[styles.timerValue, { color: text }]}>{formatTime(time)}s</Text>
          <View style={styles.sensorDataRow}>
            <Text
              style={[
                styles.helper,
                { color: liveForce > 2.2 ? '#FF4444' : mutedText, fontWeight: '600' },
              ]}>
              Impact Sensor: {liveForce.toFixed(2)}g
            </Text>
            {liveForce > 2.2 ? (
              <Text style={{ color: '#FF4444', fontSize: 10 }}> [IMPACT DETECTED]</Text>
            ) : null}
          </View>
          <View style={styles.sensorDataRow}>
            <Text style={[styles.helper, { color: mutedText }]}>GPS Status: {locationStatus}</Text>
          </View>
          <View style={styles.timerButtons}>
            <PrimaryButton
              label={isActive ? 'Stop & record' : 'Start timer'}
              variant={isActive ? 'danger' : 'primary'}
              disabled={(!isActive && attempts.length >= 3) || isSyncing}
              onPress={() => (isActive ? void stopAttempt() : startAttempt())}
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
              onPress={() => void finishAndViewResults()}
              disabled={attempts.length === 0 || isActive || isSyncing}
              style={{ borderColor: primary }}
            />
          </View>
          <View style={styles.helperRow}>
            <Text style={[styles.helper, { color: mutedText }]}>Attempts: {attempts.length}/3</Text>
            <Text style={[styles.helper, { color: primary }]}>
              Best:{' '}
              {attempts.length
                ? `${formatTime(Math.min(...attempts.map((a) => a.time)))}s`
                : '—'}
            </Text>
          </View>
        </View>

        <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Results</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>No drops recorded yet.</Text>
        ) : (
          <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
            {attempts.map((val, i) => (
              <AttemptRow
                key={i}
                index={i + 1}
                value={`${formatTime(val.time)}s`}
                isLast={i === attempts.length - 1}
              />
            ))}
          </View>
        )}
      </SectionCard>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isTabActive = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isTabActive ? primary : card,
                  borderColor: isTabActive ? primary : border,
                },
              ]}>
              <Text style={[styles.tabPillText, { color: isTabActive ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'instructions' ? renderInstructionsTab() : null}
      {screenTab === 'writeup' ? renderWriteupTab() : null}
      {screenTab === 'discussion' ? renderDiscussionTab() : null}
      {screenTab === 'calculations' ? renderCalculationsTab() : null}

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
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
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
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  subheading: { ...Typography.body, fontWeight: '600', marginBottom: Spacing.sm },
  bodyHeading: { ...Typography.section, fontSize: 14 },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  formula: { ...Typography.body, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  italic: { ...Typography.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  note: { ...Typography.small, marginTop: Spacing.sm, lineHeight: 18 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  infoCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  infoCardTitle: { ...Typography.section, fontSize: 14 },
  timerPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg },
  timerLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  timerValue: { marginTop: Spacing.sm, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerButtons: { marginTop: Spacing.md, gap: Spacing.sm },
  helperRow: { marginTop: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
