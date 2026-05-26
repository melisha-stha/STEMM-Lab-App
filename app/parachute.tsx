import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// UI and Design Constants
import { AttemptRow } from '@/components/ui/attempt-row';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { VideoScrubber } from '@/components/ui/video-scrubber';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

// Services and Hooks
import { insertTrial } from '@/hooks/database';
import { auth } from '../hooks/firebaseConfig';
import { uploadParachuteResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

const GRAVITY = 9.8;
const MAX_ATTEMPTS = 3;

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

export default function ParachuteScreen() {
  const router = useRouter();

  // Navigation and Layout State
  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');

  // Core Experiment Tracking
  const [attempts, setAttempts] = useState<ParachuteAttempt[]>([]);
  const [massKg, setMassKg] = useState<string>('');
  const [heightM, setHeightM] = useState<string>('');

  // Video Frame/FPS Analysis Engine State
  const [currentVideoUri, setCurrentVideoUri] = useState<string | null>(null);
  const videoFps = 240;

  // Marked Frame States matching User Spec Equations
  const [frameRelease, setFrameRelease] = useState<number | null>(null);
  const [frameImpact, setFrameImpact] = useState<number | null>(null);
  const [frameStop, setFrameStop] = useState<number | null>(null);
  const [bounceMode, setBounceMode] = useState<BounceMode>('no_bounce');
  const [frameMaxBounce, setFrameMaxBounce] = useState<number | null>(null);

  // Derived Values and Results
  const [calculatedOutputs, setCalculatedOutputs] = useState<{
    dropTime: number;
    contactTime: number;
    bounceTime: number | null;
    calcs: ParachuteCalculations;
    gForce: number;
  } | null>(null);

  // Theme Hooks
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  const onPrimary = useThemeColor({}, 'onPrimary');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

  const resetCurrentFrameAnalysis = () => {
    setCurrentVideoUri(null);
    setFrameRelease(null);
    setFrameImpact(null);
    setFrameStop(null);
    setFrameMaxBounce(null);
    setBounceMode('no_bounce');
    setCalculatedOutputs(null);
  };

  const captureVideoAsset = async () => {
    if (attempts.length >= MAX_ATTEMPTS || isSyncing) return;

    setIsRecording(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permissions are required to collect experiment evidence.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 20,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        resetCurrentFrameAnalysis();
        setCurrentVideoUri(result.assets[0].uri);
      }
    } finally {
      setIsRecording(false);
    }
  };

  const processFrameMathematics = () => {
    const mass = parseFloat(massKg);
    const height = parseFloat(heightM);

    if (!mass || !height || frameRelease === null || frameImpact === null || frameStop === null) {
      Alert.alert('Validation Error', 'Please specify payload mass, drop height, and mark frames in the timeline.');
      return;
    }

    const dropTime = (frameImpact - frameRelease) / videoFps;
    const contactTime = (frameStop - frameImpact) / videoFps;

    if (dropTime <= 0 || contactTime <= 0) {
      Alert.alert('Data Error', 'Invalid frame layout sequence. Ensure Release < Impact < Stop.');
      return;
    }

    const finalVelocity = height / dropTime;
    const acceleration = finalVelocity / dropTime;
    const netForce = mass * acceleration;
    const weight = mass * GRAVITY;
    const dragForce = weight - netForce;

    const calcs: ParachuteCalculations = {
      finalVelocity: Math.round(finalVelocity * 100) / 100,
      acceleration: Math.round(acceleration * 100) / 100,
      netForce: Math.round(netForce * 1000) / 1000,
      weight: Math.round(weight * 1000) / 1000,
      dragForce: Math.round(dragForce * 1000) / 1000,
    };

    let gForce = 0;
    let bounceTime: number | null = null;

    if (bounceMode === 'no_bounce') {
      gForce = finalVelocity / contactTime / GRAVITY;
    } else {
      if (frameMaxBounce === null) {
        Alert.alert('Missing Data', 'Please toggle Kinetic Bounce in the scrubber and mark the peak bounce frame.');
        return;
      }
      bounceTime = (frameMaxBounce - frameImpact) / videoFps;
      const vUp = GRAVITY * bounceTime;
      const deltaV = finalVelocity + vUp;
      gForce = deltaV / contactTime / GRAVITY;
    }

    setCalculatedOutputs({
      dropTime: Math.round(dropTime * 1000) / 1000,
      contactTime: Math.round(contactTime * 1000) / 1000,
      bounceTime: bounceTime ? Math.round(bounceTime * 1000) / 1000 : null,
      calcs,
      gForce: Math.round(gForce * 10) / 10,
    });
  };

  const commitAttemptToLocalState = () => {
    if (!calculatedOutputs) return;

    const newAttempt: ParachuteAttempt = {
      dropTimeSec: calculatedOutputs.dropTime,
      contactTimeSec: calculatedOutputs.contactTime,
      bounced: bounceMode === 'bounced',
      bounceTimeSec: calculatedOutputs.bounceTime,
      videoUri: currentVideoUri,
      calculations: calculatedOutputs.calcs,
      gForce: calculatedOutputs.gForce,
    };

    setAttempts([...attempts, newAttempt]);
    resetCurrentFrameAnalysis();
  };

  const finishAndViewResults = async () => {
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

      const teamData = await getTeamData();
      const bestAttempt = attempts.reduce((best, a) => (a.dropTimeSec > best.dropTimeSec ? a : best));

      const sanitizedAttempts = attempts.map((a) => ({
        time: Math.round(a.dropTimeSec * 1000),
        videoUri: a.videoUri || '',
        dropTimeSec: a.dropTimeSec,
        contactTimeSec: a.contactTimeSec,
        bounced: a.bounced,
        bounceTimeSec: a.bounceTimeSec,
        calculations: a.calculations,
        gForce: a.gForce,
        massKg: Number(massKg),
        heightM: Number(heightM),
      }));

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
          title: '🚀 STEMM Lab Sync Complete',
          body: `Trial data for ${teamData?.name || 'your team'} has been saved to cloud storage.`,
          data: { screen: 'results' },
        },
        trigger: null,
      });

      router.push('/results');
    } catch (error) {
      console.error('Data Sync Engine Error:', error);
      Alert.alert('Sync Error', 'Cloud synchronization failed. Data preserved in local database.');
    } finally {
      setIsSyncing(false);
    }
  };

  const getGForceRiskColor = (g: number): string => {
    if (g <= 5) return '#2E7D32';
    if (g <= 10) return '#F57F17';
    return '#D32F2F';
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

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
          <Text style={[styles.heroTitle, { color: text }]}>Parachute Drop Challenge</Text>
          <Text style={[styles.subtitle, { color: mutedText, marginBottom: Spacing.md }]}>
            Engineering + Physics
          </Text>

          <Text style={[styles.body, { color: text, lineHeight: 20 }]}>
            Students design, build, and test a parachute for a small toy to reduce its landing speed and impact force. Teams iterate their designs under time and material constraints, aiming to achieve the slowest and safest landing within a target area.
          </Text>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <Text style={[styles.sectionHeading, { color: text }]}>Equipment</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: text }]}>• Mobile phone with STEMM Lab app</Text>
            <Text style={[styles.listItem, { color: text }]}>• Small toy (e.g. army toy soldier)</Text>
            <Text style={[styles.listItem, { color: text }]}>• Table or elevated surface</Text>
            <Text style={[styles.listItem, { color: text }]}>• Paper or plastic</Text>
            <Text style={[styles.listItem, { color: text }]}>• String</Text>
            <Text style={[styles.listItem, { color: text }]}>• Scissors</Text>
            <Text style={[styles.listItem, { color: text }]}>• Tape</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <Text style={[styles.sectionHeading, { color: text }]}>Instructions</Text>
          <View style={styles.listContainer}>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>
              1. Drop the toy without a parachute and record the fall (baseline test).
            </Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>
              2. Build a parachute using provided materials.
            </Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>
              3. Drop the toy from the same height and record the fall.
            </Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>
              4. Review speed and landing accuracy results in the app.
            </Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>
              5. Redesign and test up to three prototypes within 20 minutes.
            </Text>
            <Text style={[styles.listItem, { color: text, lineHeight: 20 }]}>
              6. Upload videos, results, and team reflections.
            </Text>
          </View>

          <View style={[styles.diagramPlaceholderBox, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.diagramText, { color: mutedText }]}>
              [Diagram: Toy attached to parachute, drop height marked, target landing zone shown on floor]
            </Text>
          </View>
        </SectionCard>
      )}

      {/* ==================== TAB 2: EXPERIMENT ==================== */}
      {screenTab === 'experiment' && (
        <View style={{ gap: Spacing.md }}>
          <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
            <Text style={[styles.helper, { color: text }]}>System Status Indicators: {locationStatus}</Text>
          </View>

          <Input label="Mass of Payload toy (kg)" placeholder="e.g. 0.20" value={massKg} onChangeText={setMassKg} keyboardType="decimal-pad" />
          <Input label="Height of drop launch platform (m)" placeholder="e.g. 1.2" value={heightM} onChangeText={setHeightM} keyboardType="decimal-pad" />

          <View style={[styles.controlPanel, { borderColor: border, backgroundColor: card }]}>
            <Text style={[styles.panelTitle, { color: text }]}>Capture Experiment Data</Text>
            <Text style={[styles.helper, { color: mutedText, marginVertical: Spacing.xs }]}>
              Current Trial Stack: {attempts.length} / {MAX_ATTEMPTS}
            </Text>
            
            <PrimaryButton
              label={isRecording ? 'Awaiting System Device...' : 'Launch Camera'}
              onPress={() => void captureVideoAsset()}
              disabled={attempts.length >= MAX_ATTEMPTS || currentVideoUri !== null || isSyncing}
            />
          </View>

          {currentVideoUri && (
            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Slow-Motion Frame Analyzer</Text>
              <VideoScrubber
                uri={currentVideoUri}
                onMarkersChange={(m, mode) => {
                  setFrameRelease(m.releaseFrame);
                  setFrameImpact(m.impactFrame);
                  setFrameStop(m.stopFrame);
                  setFrameMaxBounce(m.maxBounceFrame);
                  setBounceMode(mode);
                  setCalculatedOutputs(null);
                }}
              />
              <PrimaryButton label="Execute Physics Calculations" variant="primary" style={{ marginTop: Spacing.md }} onPress={processFrameMathematics} />
            </SectionCard>
          )}

          {calculatedOutputs && (
            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Kinematic Engineering Analysis</Text>
              <View style={styles.calcOutputBox}>
                <Text style={{ color: text, fontSize: 13 }}>Drop Time: {calculatedOutputs.dropTime}s</Text>
                <Text style={{ color: text, fontSize: 13 }}>Contact Time: {calculatedOutputs.contactTime}s</Text>
                {calculatedOutputs.bounceTime !== null && (
                  <Text style={{ color: text, fontSize: 13 }}>Time to Max Bounce Height (t_up): {calculatedOutputs.bounceTime}s</Text>
                )}
                
                <Text style={{ color: text, fontSize: 13, marginTop: 4 }}>Final Velocity (v): {calculatedOutputs.calcs.finalVelocity} m/s</Text>
                <Text style={{ color: text, fontSize: 13 }}>Acceleration (a): {calculatedOutputs.calcs.acceleration} m/s²</Text>
                
                <Text style={{ color: text, fontSize: 13, marginTop: 4 }}>Downward Force (Weight): {calculatedOutputs.calcs.weight} N</Text>
                <Text style={{ color: text, fontSize: 13 }}>Net Force (F_net): {calculatedOutputs.calcs.netForce} N</Text>
                <Text style={{ color: text, fontSize: 13 }}>Upward Force (Drag Force): {calculatedOutputs.calcs.dragForce} N</Text>
                
                <Text style={[styles.gForceText, { color: getGForceRiskColor(calculatedOutputs.gForce) }]}>
                  Impact G-Force: {calculatedOutputs.gForce} g
                </Text>
              </View>
              <PrimaryButton label="Save and Lock Trial Results" variant="secondary" style={{ borderColor: primary, marginTop: Spacing.sm }} onPress={commitAttemptToLocalState} />
            </SectionCard>
          )}

          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Trial Baseline Array</Text>
            {attempts.length === 0 ? (
              <Text style={{ color: mutedText, fontSize: 12, fontStyle: 'italic' }}>Awaiting valid experiment metrics updates.</Text>
            ) : (
              attempts.map((item, index) => (
                <AttemptRow key={index} index={index + 1} value={`Air Time: ${item.dropTimeSec}s | Impact: ${item.gForce}g`} isLast={index === attempts.length - 1} />
              ))
            )}

            {attempts.length > 0 && (
              <PrimaryButton label={isSyncing ? 'Syncing...' : 'Upload Configuration Data'} variant="primary" style={{ marginTop: Spacing.md }} onPress={() => void finishAndViewResults()} disabled={isSyncing} />
            )}
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 3: WRITE-UP ==================== */}
      {screenTab === 'writeup' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Write-up Template</Text>
            <Text style={[styles.body, { color: mutedText, fontStyle: 'italic', marginBottom: Spacing.sm }]}>
              Use these questions as a guide for your physical paper lesson worksheet:
            </Text>
            
            <View style={styles.promptListContainer}>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Predict which parachute design will perform the best.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Sketch each distinctive prototype layout design on paper.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Record the calculated flight times of each attempt configuration.</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Were your structural predictions correct in final timings?</Text>
              <Text style={[styles.bulletPrompt, { color: text }]}>• Which canopy design layout was the easiest to manufacture?</Text>
            </View>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, marginBottom: Spacing.xs }]}>Worksheet Reference Table</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={[styles.matrixTableGrid, { borderColor: border }]}>
                <View style={[styles.matrixHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 140 }]}>Configuration Profile</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 100 }]}>Predicted Time</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 110 }]}>Drop Time (Air Time)</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 90 }]}>Prediction Correct?</Text>
                  <Text style={[styles.tableHeaderCell, { color: text, width: 140 }]}>Contact Stop Time (Slow-Mo)</Text>
                </View>

                {[
                  { id: '1', label: 'Action 1: Baseline (No Parachute)' },
                  { id: '2', label: 'Action 2: 4-Corner Plastic Canopy' },
                  { id: '3', label: 'Action 3: Custom Prototype' }
                ].map((row, idx) => (
                  <View key={row.id} style={[styles.matrixDataRow, { borderBottomWidth: idx === 2 ? 0 : 1, borderBottomColor: border }]}>
                    <Text style={[styles.tableBodyCell, { color: text, fontWeight: '600', width: 140 }]}>{row.label}</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 100 }]}>Fill on paper...</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 110 }]}>Fill on paper...</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 90 }]}>[  ] Y / [  ] N</Text>
                    <Text style={[styles.tableBodyCell, { color: mutedText, fontStyle: 'italic', width: 140 }]}>Fill on paper...</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={[styles.fieldSubHintText, { color: mutedText, marginTop: Spacing.xs, textAlign: 'center' }]}>
              All cells are for reference — fill these values directly into your physical print sheets during active drops.
            </Text>
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 4: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <View style={{ gap: Spacing.md }}>
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Discussion: Parachutes and Forces</Text>
            <Text style={[styles.body, { color: text, lineHeight: 19 }]}>
              Gravity pulls physical mass objects downward, causing them to accelerate as they fall. A deployment canopy structure increases air resistance, which is also commonly referred to as **drag force**.
            </Text>
            <Text style={[styles.body, { color: text, lineHeight: 19, marginTop: Spacing.xs }]}>
              Drag force acts directly upward, opposing kinetic descent velocity to produce a slower total fall. A slower terminal landing speed limits the sudden kinetic shock force when the toy hits the surface, ensuring a safer landing zone payload.
            </Text>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, marginBottom: Spacing.xs }]}>Forces Acting on the Toy</Text>
            <View style={[styles.matrixTableGrid, { borderColor: border }]}>
              <View style={[styles.matrixHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
                <Text style={[styles.tableHeaderCell, { color: text, flex: 1 }]}>Vector Force Direction</Text>
                <Text style={[styles.tableHeaderCell, { color: text, flex: 1.2 }]}>Formula Derivation Equation</Text>
              </View>
              <View style={[styles.matrixDataRow, { borderBottomColor: border }]}>
                <Text style={[styles.tableBodyCell, { color: text, flex: 1 }]}>Downward (Weight)</Text>
                <Text style={[styles.tableBodyCell, { color: primary, fontWeight: 'bold', flex: 1.2 }]}>Weight = mass × g</Text>
              </View>
              <View style={[styles.matrixDataRow, { borderBottomColor: border }]}>
                <Text style={[styles.tableBodyCell, { color: text, flex: 1 }]}>Upward (Drag Force)</Text>
                <Text style={[styles.tableBodyCell, { color: mutedText, flex: 1.2 }]}>Air resistance counteraction</Text>
              </View>
              <View style={[styles.matrixDataRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.tableBodyCell, { color: text, flex: 1 }]}>Net (Total) Force</Text>
                <Text style={[styles.tableBodyCell, { color: primary, fontWeight: 'bold', flex: 1.2 }]}>Net Force = Weight - Drag</Text>
              </View>
            </View>
            <Text style={[styles.newtonLawCallout, { backgroundColor: card, borderColor: border, color: text }]}>
              Newton’s Second Law: Net Force = mass × acceleration
            </Text>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text }]}>G-Force and Injury Risk Analysis</Text>
            <Text style={[styles.body, { color: mutedText, fontSize: 12, marginBottom: Spacing.sm }]}>
              G-force describes how quickly an object decelerates on sudden impact. It is measured in multiples of baseline planetary gravity acceleration constants where g = 9.8 m/s².
            </Text>

            <View style={[styles.matrixTableGrid, { borderColor: border }]}>
              <View style={[styles.matrixHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
                <Text style={[styles.tableHeaderCell, { color: text, width: 85 }]}>G-Force Range</Text>
                <Text style={[styles.tableHeaderCell, { color: text, width: 130 }]}>Real-World Examples</Text>
                <Text style={[styles.tableHeaderCell, { color: text, width: 115 }]}>Likely Structural Effects</Text>
              </View>
              {[
                { range: '1–5 g', ex: 'Amusement park rides', effect: 'Safe; no damage risk' },
                { range: '5–10 g', ex: 'Hard dynamic running drops', effect: 'Minor deformation risk' },
                { range: '10–30 g', ex: 'Bicycle or sports crashes', effect: 'Serious stress failures' },
                { range: '30–50 g', ex: 'Falls onto solid surfaces', effect: 'Severe structural rupture' },
                { range: '50+ g', ex: 'Sudden dead stops (no cushion)', effect: 'Catastrophic destruction' }
              ].map((item, index) => (
                <View key={index} style={[styles.matrixDataRow, { borderBottomWidth: index === 4 ? 0 : 1, borderBottomColor: border }]}>
                  <Text style={[styles.tableBodyCell, { color: text, fontWeight: '700', width: 85 }]}>{item.range}</Text>
                  <Text style={[styles.tableBodyCell, { color: text, width: 130 }]}>{item.ex}</Text>
                  <Text style={[styles.tableBodyCell, { color: text, width: 115 }]}>{item.effect}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard>
            <Text style={[styles.bodyHeading, { color: text, fontSize: 13, marginBottom: 4 }]}>Curriculum Links Reference</Text>
            <Text style={[styles.bullet, { color: text }]}>• Science (Physics): ACSSU073 – Wave mechanics, sound intensity, and kinetic energy properties.</Text>
            <Text style={[styles.bullet, { color: text, marginTop: 2 }]}>• Health & Safety: ACPPS053 – Environmental hazard controls and auditory wellbeing.</Text>
          </SectionCard>
        </View>
      )}   
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPillText: { ...Typography.small, fontWeight: '700' },
  heroTitle: { ...Typography.hero, fontSize: 26, fontWeight: '800' },
  sectionTitle: { ...Typography.section, fontSize: 16, marginBottom: Spacing.xs },
  bodyHeading: { ...Typography.section, fontSize: 13, marginTop: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 18 },
  helper: { ...Typography.small, fontSize: 12 },
  infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  controlPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg },
  panelTitle: { ...Typography.section, fontSize: 15 },
  markerControlGrid: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  statusIndicatorBox: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calcOutputBox: { padding: Spacing.md, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: Radius.md, gap: 4 },
  gForceText: { fontSize: 16, fontWeight: '900', marginTop: Spacing.xs },
  promptListContainer: { gap: 6, marginVertical: Spacing.xs, paddingLeft: 4 },
  bulletPrompt: { ...Typography.body, fontSize: 13, lineHeight: 18 },
  matrixTableGrid: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.xs },
  matrixHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: Spacing.sm },
  matrixDataRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: 'bold' },
  tableBodyCell: { ...Typography.small, fontSize: 12 },
  newtonLawCallout: { marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.sm, textAlign: 'center', fontWeight: 'bold', fontSize: 13 },
  fieldSubHintText: { ...Typography.small, fontSize: 10 },
  subtitle: { ...Typography.small, fontSize: 14, fontWeight: '600', marginTop: 2 },
  sectionHeading: { ...Typography.section, fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  divider: { height: 1, marginVertical: Spacing.md, opacity: 0.6 },
  listContainer: { gap: 8, marginBottom: Spacing.md },
  listItem: { ...Typography.body, fontSize: 14, paddingLeft: 4 },
  bullets: { gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  diagramPlaceholderBox: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagramText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
});