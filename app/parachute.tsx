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

const GRAVITY = 9.8; //
const MAX_ATTEMPTS = 3; //

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

    // time = delta_frames / FPS
    const dropTime = (frameImpact - frameRelease) / videoFps;
    const contactTime = (frameStop - frameImpact) / videoFps;

    if (dropTime <= 0 || contactTime <= 0) {
      Alert.alert('Data Error', 'Invalid frame layout sequence. Ensure Release < Impact < Stop.');
      return;
    }

    // User Spec Step-by-Step Physics Mappings
    const finalVelocity = height / dropTime; // Step 3
    const acceleration = finalVelocity / dropTime; // Step 4
    const netForce = mass * acceleration; // Step 5
    const weight = mass * GRAVITY; // Step 6
    const dragForce = weight - netForce; // Step 6

    const calcs: ParachuteCalculations = {
      finalVelocity: Math.round(finalVelocity * 100) / 100,
      acceleration: Math.round(acceleration * 100) / 100,
      netForce: Math.round(netForce * 1000) / 1000,
      weight: Math.round(weight * 1000) / 1000,
      dragForce: Math.round(dragForce * 1000) / 1000,
    };

    let gForce = 0;
    let bounceTime: number | null = null;

    // Case 1 vs Case 2 User Spec Routing
    if (bounceMode === 'no_bounce') {
      gForce = finalVelocity / contactTime / GRAVITY; // Case 1 formula
    } else {
      if (frameMaxBounce === null) {
        Alert.alert('Missing Data', 'Please toggle Kinetic Bounce in the scrubber and mark the peak bounce frame.');
        return;
      }
      bounceTime = (frameMaxBounce - frameImpact) / videoFps;
      const vUp = GRAVITY * bounceTime; // Upward velocity calculation
      const deltaV = finalVelocity + vUp; // Δv = v_down + v_up
      gForce = deltaV / contactTime / GRAVITY; // Case 2 formula
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
    if (g <= 5) return '#2E7D32'; // Secure
    if (g <= 10) return '#F57F17'; // Caution
    return '#D32F2F'; // Severe risk
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

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

      {screenTab === 'overview' && (
        <SectionCard>
          <Text style={[styles.heroTitle, { color: text }]}>Parachute Drop Challenge</Text>
          <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
            Design, construct, and measure a landing parachute solution to minimize impact terminal speed and reduce destruction G-forces.
          </Text>
        </SectionCard>
      )}

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

          {/* Output Display of Current Physics Calculations matching User Spec perfectly */}
          {calculatedOutputs && (
            <SectionCard>
              <Text style={[styles.sectionTitle, { color: text }]}>Kinematic Engineering Analysis</Text>
              <View style={styles.calcOutputBox}>
                {/* Time Metrics */}
                <Text style={{ color: text, fontSize: 13 }}>Drop Time: {calculatedOutputs.dropTime}s</Text>
                <Text style={{ color: text, fontSize: 13 }}>Contact Time: {calculatedOutputs.contactTime}s</Text>
                {calculatedOutputs.bounceTime !== null && (
                  <Text style={{ color: text, fontSize: 13 }}>Time to Max Bounce Height (t_up): {calculatedOutputs.bounceTime}s</Text>
                )}
                
                {/* Kinematics Progression */}
                <Text style={{ color: text, fontSize: 13, marginTop: 4 }}>Final Velocity (v): {calculatedOutputs.calcs.finalVelocity} m/s</Text>
                <Text style={{ color: text, fontSize: 13 }}>Acceleration (a): {calculatedOutputs.calcs.acceleration} m/s²</Text>
                
                {/* Dynamic Forces Stack */}
                <Text style={{ color: text, fontSize: 13, marginTop: 4 }}>Downward Force (Weight): {calculatedOutputs.calcs.weight} N</Text>
                <Text style={{ color: text, fontSize: 13 }}>Net Force (F_net): {calculatedOutputs.calcs.netForce} N</Text>
                <Text style={{ color: text, fontSize: 13 }}>Upward Force (Drag Force): {calculatedOutputs.calcs.dragForce} N</Text>
                
                {/* Final Target Metric */}
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

      {screenTab === 'writeup' && <SectionCard><Text style={{ color: text }}>Refer to paper curriculum worksheets.</Text></SectionCard>}
      {screenTab === 'discussion' && <SectionCard><Text style={{ color: text }}>Review Newton&apos;s Second Law physics properties.</Text></SectionCard>}
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
  heroTitle: { ...Typography.hero, fontSize: 24 },
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
});