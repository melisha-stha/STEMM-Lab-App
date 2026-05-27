import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { uploadPerformanceResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

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

const MOVEMENT_DURATION_MS = 30000;
const SENSOR_INTERVAL_MS = 100;

type Attempt = {
  memberName: string;
  movement: string;
  peakForce: number;
  averageForce: number;
  durationSec: number;
};

export default function PerformanceScreen() {
  const router = useRouter();
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
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  const onPrimary = useThemeColor({}, 'onPrimary' as any) ?? '#FFFFFF';

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
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
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

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Performance results for ${teamData?.name || 'your team'} have been saved!`,
          data: { screen: 'performance-results' },
        },
        trigger: null,
      });

      Alert.alert('Saved!', 'Your performance results have been saved.', [
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
    <SectionCard>
      <Text style={[styles.heroTitle, { color: text }]}>Human Performance Lab</Text>
      <Text style={[styles.heroSubtitle, { color: mutedText }]}>Medical Science + Biomechanics</Text>
      <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
        Students investigate how the human body moves by measuring speed, smoothness, and coordination during controlled stretching activities. The phone's accelerometer measures how gracefully you move — the lower the reading, the smoother the movement.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Mobile phone with STEMM Lab app</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Open space to move safely</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>1. Hold the phone firmly in one hand.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>2. Press Start on the Experiment tab.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>3. Perform the guided movement as slowly and smoothly as possible for 30 seconds.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>4. The app automatically stops and records your score at the end of the countdown.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>5. Complete all 3 movements and compare results.</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>6. Save and reflect as a group.</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>The 3 Movements</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        {MOVEMENTS.map((m, i) => (
          <View key={i} style={styles.movementRow}>
            <Text style={[styles.movementLabel, { color: primary }]}>{m.label}:</Text>
            <Text style={[styles.bullet, { color: mutedText, flex: 1 }]}>{m.description}</Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );

  const renderExperimentTab = () => {
    const currentMovement = MOVEMENTS[currentMovementIndex];
    const score = getScoreLabel(liveForce);

    return (
      <View style={styles.experimentWrap}>
        <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
          <Text style={[styles.inputLabel, { color: text, marginTop: 0 }]}>Participant Student Name</Text>
          <TextInput
            style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background, marginBottom: Spacing.sm }]}
            placeholder="Enter student name..."
            placeholderTextColor={mutedText}
            value={memberName}
            onChangeText={setMemberName}
            editable={!isActive}
          />
          <Text style={[styles.helper, { color: mutedText }]}>GPS Status: {locationStatus}</Text>
          {memberName.trim().length > 0 && (
            <Text style={[styles.helper, { color: mutedText, marginTop: 4 }]}>
              Attempts recorded for {memberName.trim()}: {filteredAttempts.length}/{MOVEMENTS.length}
            </Text>
          )}
        </View>

        {!allDone && memberName.trim().length > 0 && (
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>{currentMovement.label}</Text>
            <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.md }]}>
              {currentMovement.description}
            </Text>

            {isActive && (
              <View style={styles.timerTrackField}>
                <View style={[styles.timerProgressBarFill, { width: timeBarWidthPercent as any, backgroundColor: primary }]} />
                <Text style={styles.timerPercentageText}>Time Remaining: {Math.ceil(timeLeftMs / 1000)}s</Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { color: mutedText }]}>Live Sensor Reading</Text>
            <Text style={[styles.liveForce, { color: isActive ? score.color : mutedText }]}>
              {liveForce.toFixed(2)} g
            </Text>
            {isActive && (
              <Text style={[styles.scoreLabel, { color: score.color }]}>{score.label}</Text>
            )}

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
          </SectionCard>
        )}

        {filteredAttempts.length > 0 && (
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Recorded Movements ({memberName.trim()})</Text>
            {filteredAttempts.map((a, i) => {
              const s = getScoreLabel(a.averageForce);
              return (
                <View key={i} style={[styles.attemptRow, { borderTopColor: border, borderTopWidth: i === 0 ? 0 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bodyHeading, { color: text }]}>{a.movement}</Text>
                    <Text style={[styles.body, { color: mutedText }]}>
                      Average Deviation: {a.averageForce} g  |  Peak: {a.peakForce} g  |  Duration: {a.durationSec}s
                    </Text>
                  </View>
                  <View style={[styles.scoreBadge, { backgroundColor: s.color + '22', borderColor: s.color }]}>
                    <Text style={[styles.scoreBadgeText, { color: s.color }]}>
                      {a.averageForce < 0.15 ? 'Excellent' : a.averageForce < 0.35 ? 'Good' : 'Needs Practice'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </SectionCard>
        )}

        {allDone && (
          <View style={{ gap: Spacing.sm }}>
            <PrimaryButton
              label={isSyncing ? 'Saving...' : 'Finish & Save Results'}
              onPress={handleSave}
              disabled={isSyncing}
              style={{ borderColor: primary }}
            />
            <PrimaryButton
              label="Next Team Member Setup"
              variant="secondary"
              onPress={prepNextTeamMember}
              style={{ borderStyle: 'dashed', borderColor: primary }}
            />
          </View>
        )}

        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Team Progress Manifest Log</Text>
          {attempts.length === 0 ? (
            <Text style={[styles.bullet, { color: mutedText }]}>No local participant records populated in this cycle yet.</Text>
          ) : (
            attempts.map((item, index) => (
              <View key={index} style={styles.teamLogItemRow}>
                <Text style={[styles.body, { color: text, fontWeight: '700' }]}>{item.memberName}</Text>
                <Text style={[styles.body, { color: mutedText }]}>{item.movement}: {item.averageForce} g avg</Text>
              </View>
            ))
          )}
        </SectionCard>
      </View>
    );
  };

  const renderWriteupTab = () => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Write-up (on paper)</Text>
      <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.md }]}>
        Use the questions below to complete your write-up in your exercise book.
      </Text>

      {[
        'Which movement was the hardest to keep the vibration low?',
        'Record the results.',
        'Were you right? Any surprises?',
      ].map((q, i) => (
        <View key={i} style={[styles.questionBlock, { borderTopColor: border }]}>
          <Text style={[styles.questionNumber, { color: primary }]}>{i + 1}.</Text>
          <Text style={[styles.questionText, { color: text }]}>{q}</Text>
        </View>
      ))}

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Table Template</Text>
      <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.sm }]}>Copy this table into your exercise book.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.table, { borderColor: border, minWidth: 520 }]}>
          <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
            {['', 'Predict Phone Vibration (absolute)', 'Outcome (time + movement)', 'Were you right?'].map((h, i) => (
              <Text key={i} style={[styles.tableHeaderCell, { color: text, width: i === 0 ? 100 : 140 }]}>{h}</Text>
            ))}
          </View>
          {['Attempt 1', 'Attempt 2', 'Attempt 3'].map((label, i) => (
            <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? background : card, borderBottomColor: border, borderBottomWidth: i < 2 ? 1 : 0 }]}>
              <Text style={[styles.tableCell, { color: text, width: 100, fontWeight: '700' }]}>{label}</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 140 }]}>e.g. +/- 1cm</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 140 }]}>{i === 0 ? '5mm in 20 seconds' : i === 1 ? '5mm in 5 seconds' : ' '}</Text>
              <Text style={[styles.tableCell, { color: mutedText, width: 140 }]}> </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SectionCard>
  );

  const renderDiscussionTab = () => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Discussion</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Muscles and joints work together to create movement. Faster movements often reduce control, while smoother movements show better coordination. Sensors in the phone measure how quickly and smoothly the body moves, helping students understand biomechanics and fatigue.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Why does speed reduce control?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        When you move faster, your muscles have less time to make fine adjustments. This causes more wobble and higher accelerometer readings. Slow, deliberate movements allow your nervous system to continuously correct your path.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>What does the sensor actually measure?</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        The accelerometer measures g-force — the rate of change in velocity in all three directions (x, y, z). When you move smoothly, these values stay close to 1g (gravity). Sudden jerks or fast movements spike the readings above 1g.
      </Text>

      <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Curriculum Links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>Health & Physical Education:</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACPPS051 — Movement skills</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACPPS054 — Physical performance</Text>
        <Text style={[styles.bullet, { color: mutedText, marginTop: Spacing.xs }]}>Science (Biology):</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• ACSSU176 — Structure and function of body systems</Text>
      </View>
    </SectionCard>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top']}>
      <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>

        <View style={styles.tabRow}>
          {SCREEN_TABS.map(tab => {
            const isActive = screenTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setScreenTab(tab)}
                style={[styles.tabPill, { backgroundColor: isActive ? primary : card, borderColor: isActive ? primary : border }]}
              >
                <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>
                  {SCREEN_TAB_LABELS[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {screenTab === 'overview' && renderOverviewTab()}
        {screenTab === 'experiment' && renderExperimentTab()}
        {screenTab === 'writeup' && renderWriteupTab()}
        {screenTab === 'discussion' && renderDiscussionTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  tabPillText: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  heroTitle: { ...Typography.hero, fontSize: 26 },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bodyHeading: { ...Typography.section, fontSize: 14, marginBottom: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  movementRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: 6 },
  movementLabel: { ...Typography.small, fontWeight: '700', minWidth: 90 },
  experimentWrap: { gap: Spacing.md },
  infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  helper: { ...Typography.small },
  inputLabel: { ...Typography.small, marginBottom: 6, marginTop: Spacing.xs, fontWeight: '700' },
  inputBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, height: 40, fontSize: 13 },
  liveForce: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: Spacing.sm },
  scoreLabel: { ...Typography.body, fontWeight: '600', marginBottom: Spacing.sm },
  buttonRow: { flexDirection: 'row', marginTop: Spacing.sm },
  attemptRow: { paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scoreBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  scoreBadgeText: { ...Typography.small, fontWeight: '700' },
  questionBlock: { flexDirection: 'row', gap: Spacing.sm, borderTopWidth: 1, paddingVertical: Spacing.sm, alignItems: 'flex-start' },
  questionNumber: { ...Typography.section, fontSize: 14, minWidth: 20 },
  questionText: { ...Typography.body, fontSize: 13, lineHeight: 20, flex: 1 },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'flex-start' },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
  teamLogItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  timerTrackField: { height: 24, width: '100%', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: Radius.sm, overflow: 'hidden', marginBottom: Spacing.md, justifyContent: 'center', position: 'relative' },
  timerProgressBarFill: { height: '100%', left: 0, position: 'absolute', opacity: 0.25 },
  timerPercentageText: { ...Typography.small, fontSize: 11, fontWeight: '700', paddingHorizontal: Spacing.sm, zIndex: 2 }
});