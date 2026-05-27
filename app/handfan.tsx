import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { uploadHandFanResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

const MATERIALS_LIST = [
  { label: 'Thin printer paper', k: 0.05, thickness: '0.1' },
  { label: 'Standard card stock', k: 0.20, thickness: '0.25' },
  { label: 'Thin cardboard', k: 0.50, thickness: '0.5' },
  { label: 'Corrugated cardboard', k: 2.50, thickness: '3.0' },
] as const;

const DISTANCES_LIST = ['15cm', '30cm', '45cm'] as const;

interface DesignTrial {
  memberName: string;
  designName: string;
  distance: string;
  materialLabel: string;
  kValue: number;
  bendAngleDeg: string;
  computedForceN: number | null;
  videoUri: string | null;
}

export default function HandFanScreen() {
  const router = useRouter();
  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Searching...');

  // New Multi-User Trackers
  const [memberName, setMemberName] = useState('');
  const [attempts, setAttempts] = useState<DesignTrial[]>([]);

  // Interactive Current Trial Inputs
  const [designName, setDesignName] = useState('');
  const [selectedDistance, setSelectedDistance] = useState<'15cm' | '30cm' | '45cm'>('30cm');
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number>(0);
  const [bendAngleText, setBendAngleText] = useState('');
  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);

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
  }, []);

  // LIVE AERODYNAMIC PHYSICS MATHEMATICAL ENGINE
  const computedForceOutput = useMemo(() => {
    const angleDegrees = parseFloat(bendAngleText);
    if (isNaN(angleDegrees) || angleDegrees <= 0) return null;

    // 1. Convert degrees to structural radians: θ_rad = degrees × (π / 180)
    const radians = angleDegrees * (Math.PI / 180);
    const materialK = MATERIALS_LIST[selectedMaterialIndex].k;

    // 2. Solve structural load formula: F = k × θ
    const rawForce = materialK * radians;
    
    // Return formatted precision force metric
    return parseFloat(rawForce.toFixed(4));
  }, [bendAngleText, selectedMaterialIndex]);

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoMaxDuration: 15,
    });
    if (!result.canceled && result.assets[0]) {
      setRecordedVideoUri(result.assets[0].uri);
    }
  };

  // Aggregates active parameters cleanly into the participant manifest array
  const logCurrentTrialToManifest = () => {
    if (!memberName.trim()) {
      Alert.alert('Identity Required', 'Please assign a student name to allocate lab trial records.');
      return;
    }
    if (!designName.trim()) {
      Alert.alert('Design Label Required', 'Please name your fan design variant (e.g., Folded Flaps).');
      return;
    }
    const parsedAngle = parseFloat(bendAngleText);
    if (isNaN(parsedAngle) || parsedAngle < 0 || parsedAngle > 90) {
      Alert.alert('Invalid Angle', 'Please record a structural target bend metric between 0° and 90°.');
      return;
    }

    const currentMaterial = MATERIALS_LIST[selectedMaterialIndex];

    const newTrial: DesignTrial = {
      memberName: memberName.trim(),
      designName: designName.trim(),
      distance: selectedDistance,
      materialLabel: currentMaterial.label,
      kValue: currentMaterial.k,
      bendAngleDeg: bendAngleText,
      computedForceN: computedForceOutput,
      videoUri: recordedVideoUri,
    };

    setAttempts((prev) => [
      ...prev.filter((a) => !(a.memberName === newTrial.memberName && a.designName === newTrial.designName)),
      newTrial,
    ]);

    // Clear current test inputs to make room for another design trial
    setDesignName('');
    setBendAngleText('');
    setRecordedVideoUri(null);
    Alert.alert('Trial Logged', 'Results stored cleanly into your progress report manifest.');
  };

  const clearActiveFormInputs = () => {
    setDesignName('');
    setBendAngleText('');
    setRecordedVideoUri(null);
  };

  const clearForNextTeamMember = () => {
    clearActiveFormInputs();
    setMemberName('');
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign In Required', 'Log in to push localized manifest data links down into secure storage links.');
      return;
    }
    if (attempts.length === 0) {
      Alert.alert('Empty Records', 'Log at least one design challenge trial before syncing data.');
      return;
    }

    setIsSyncing(true);
    try {
      let locationData = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      const teamData = await getTeamData();
      
      // Select best trial result to baseline data pipelines
      const maxForceRecord = Math.max(...attempts.map((d) => d.computedForceN || 0));

      // Map local UI dataset records smoothly into standard database schemas
      const mappedPayloadForFirestore = attempts.map((a) => ({
        design: a.designName,
        bendAngle: a.bendAngleDeg,
        outcome: a.computedForceN ? `${a.computedForceN}N` : '0N',
        notes: `Material: ${a.materialLabel} at distance ${a.distance}`,
        videoUri: a.videoUri,
      }));

      await Promise.all([
        uploadHandFanResult(user.uid, teamData, mappedPayloadForFirestore, locationData),
        Promise.resolve(
          insertTrial(teamData?.name || 'unknown', 'handfan', maxForceRecord, '', locationData?.latitude || null, locationData?.longitude || null)
        ),
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `Hand Fan results for ${teamData?.name || 'your team'} have been saved!`,
        },
        trigger: null,
      });

      Alert.alert('Saved Successfully!', 'All group lab assets are uploaded into the cloud dashboard.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error) {
      console.error('Hand Fan Save Error:', error);
      Alert.alert('Save Error', 'Connection issue dropped storage manifest pipeline syncing updates.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isActive = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[styles.tabPill, { backgroundColor: isActive ? primary : card, borderColor: isActive ? primary : border }]}
            >
              <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>{SCREEN_TAB_LABELS[tab]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {screenTab === 'overview' && (
        <SectionCard>
          <Text style={[styles.heroTitle, { color: text }]}>Hand Fan Challenge</Text>
          <Text style={[styles.heroSubtitle, { color: mutedText }]}>Physics – Air Movement</Text>
          <Text style={[styles.body, { color: mutedText, marginTop: Spacing.sm }]}>
            Students test how air movement affects flexible materials. By designing and using hand fans, teams discover how air force, material stiffness, and distance affect how much a paper strip bends.
          </Text>

          <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
          <View style={[styles.bullets, { borderTopColor: border }]}>
            {['Paper and cardboard', 'Scissors', 'Mobile phone', 'Sticky Tape', 'STEMM Mobile App'].map((item, i) => (
              <Text key={i} style={[styles.bullet, { color: mutedText }]}>• {item}</Text>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
          <View style={[styles.bullets, { borderTopColor: border }]}>
            {[
              'Stand paper upright on a table.',
              'Fan air from 30 cm away.',
              'Observe and record the bend angle.',
              'Repeat with different fan designs.',
              'Repeat at distances of 15cm, 30cm, and 45cm.',
              'Repeat with cardboard instead of paper.',
            ].map((step, i) => (
              <Text key={i} style={[styles.bullet, { color: mutedText }]}>{i + 1}. {step}</Text>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Calculations Framework</Text>
          <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.xs }]}>
            Approximate force dynamically using $F \approx k \cdot \theta$ where:
          </Text>
          <View style={[styles.bullets, { borderTopColor: border }]}>
            <Text style={[styles.bullet, { color: mutedText }]}>• $F$ = force applied in Newtons (N)</Text>
            <Text style={[styles.bullet, { color: mutedText }]}>• $\theta$ = bend angle converted directly into radians</Text>
            <Text style={[styles.bullet, { color: mutedText }]}>• $k$ = material stiffness resistance parameter</Text>
          </View>

          <Text style={[styles.bodyHeading, { color: text, marginTop: Spacing.md }]}>Material Stiffness Constants Reference</Text>
          <View style={[styles.table, { borderColor: border }]}>
            <View style={[styles.tableHeaderRow, { backgroundColor: card, borderBottomColor: border }]}>
              {['Material', 'Thick (mm)', 'k (N/rad)'].map((h, i) => (
                <Text key={i} style={[styles.tableHeaderCell, { color: text, flex: 1 }]}>{h}</Text>
              ))}
            </View>
            {MATERIALS_LIST.map((row, i) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? background : card, borderBottomColor: border }]}>
                <Text style={[styles.tableCell, { color: text, flex: 1, fontWeight: '700' }]}>{row.label}</Text>
                <Text style={[styles.tableCell, { color: mutedText, flex: 1 }]}>{row.thickness}</Text>
                <Text style={[styles.tableCell, { color: primary, flex: 1, fontWeight: '700' }]}>{row.k}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      )}

      {/* ==================== TAB 2: ACTIVE EXPERIMENT MODELLING ==================== */}
      {screenTab === 'experiment' && (
        <View style={styles.experimentWrap}>
          <View style={[styles.infoCard, { borderColor: border, backgroundColor: card }]}>
            <Text style={[styles.inputLabel, { color: text, marginTop: 0 }]}>Participant Identity Name</Text>
            <TextInput
              style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background, marginBottom: Spacing.sm }]}
              placeholder="Input user identity..."
              placeholderTextColor={mutedText}
              value={memberName}
              onChangeText={setMemberName}
            />
            <Text style={[styles.helper, { color: mutedText }]}>GPS Module Lock: {locationStatus}</Text>
          </View>

          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Log Active Trial Parameters</Text>

            <Text style={[styles.inputLabel, { color: text }]}>Fan Design Label</Text>
            <TextInput
              style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background }]}
              placeholder="e.g. 1cm Accordion Folds"
              placeholderTextColor={mutedText}
              value={designName}
              onChangeText={setDesignName}
            />

            {/* Target Test Wind Distance Selector */}
            <Text style={[styles.inputLabel, { color: text }]}>Wind Distance Boundary</Text>
            <View style={styles.selectorPillRow}>
              {DISTANCES_LIST.map((dist) => {
                const isChosen = selectedDistance === dist;
                return (
                  <TouchableOpacity
                    key={dist}
                    onPress={() => setSelectedDistance(dist as any)}
                    style={[styles.pillSelectorItem, { backgroundColor: isChosen ? primary : card, borderColor: border }]}
                  >
                    <Text style={[styles.pillSelectorText, { color: isChosen ? onPrimary : text }]}>{dist}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Target Material Standing Block Stiffness Selector */}
            <Text style={[styles.inputLabel, { color: text }]}>Standing target paper material</Text>
            <View style={styles.materialBlockListColumn}>
              {MATERIALS_LIST.map((mat, index) => {
                const isChosen = selectedMaterialIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedMaterialIndex(index)}
                    style={[styles.materialRowSelector, { backgroundColor: isChosen ? primary : card, borderColor: border }]}
                  >
                    <Text style={[styles.materialRowText, { color: isChosen ? onPrimary : text, fontWeight: isChosen ? '700' : '400' }]}>
                      {mat.label} (k = {mat.k})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: text }]}>Observed Bend Angle (°)</Text>
                <TextInput
                  style={[styles.inputBox, { borderColor: border, color: text, backgroundColor: background }]}
                  placeholder="e.g. 30"
                  placeholderTextColor={mutedText}
                  keyboardType="numeric"
                  value={bendAngleText}
                  onChangeText={setBendAngleText}
                />
              </View>
            </View>

            {/* REALTIME LABORATORY METRICS COGNITIVE DISPLAY BOX */}
            {computedForceOutput !== null && (
              <View style={[styles.physicsHUDMetricsBox, { backgroundColor: background, borderColor: primary }]}>
                <Text style={[styles.hudLabelText, { color: mutedText }]}>COMPUTED AERODYNAMIC DRAG FORCE</Text>
                <Text style={[styles.hudValueText, { color: primary }]}>{computedForceOutput} N</Text>
              </View>
            )}

            <View style={{ gap: Spacing.xs, marginTop: Spacing.md }}>
              <PrimaryButton label={recordedVideoUri ? '🎬 Re-record Trial Motion' : '📹 Record Trial Motion'} variant="secondary" onPress={recordVideo} />
              {recordedVideoUri && (
                <Video source={{ uri: recordedVideoUri }} style={[styles.videoPlayer, { borderColor: border, borderWidth: 1 }]} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false} />
              )}
            </View>

            <View style={styles.actionControlRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Log Current Trial" onPress={logCurrentTrialToManifest} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Reset Form" variant="secondary" onPress={clearActiveFormInputs} />
              </View>
            </View>
          </SectionCard>

          {/* Aggregated Student Run Reports Dashboard Module */}
          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Group Performance Records Manifest Log</Text>
            {attempts.length === 0 ? (
              <Text style={[styles.bullet, { color: mutedText }]}>No experimental vectors stored down inside this sequence yet.</Text>
            ) : (
              attempts.map((item, index) => (
                <View key={index} style={[styles.attemptRowListItem, { borderBottomColor: border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.body, { color: text, fontWeight: '700' }]}>{item.memberName} — {item.designName}</Text>
                    <Text style={[styles.body, { color: mutedText, fontSize: 11 }]}>
                      Material: {item.materialLabel} | Dist: {item.distance}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.body, { color: primary, fontWeight: '700' }]}>{item.computedForceN ?? 0} N</Text>
                    <Text style={[styles.body, { color: mutedText, fontSize: 11 }]}>{item.bendAngleDeg}° Bend</Text>
                  </View>
                </View>
              ))
            )}

            {attempts.length > 0 && (
              <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                <PrimaryButton label={isSyncing ? 'Syncing...' : 'Upload Complete Manifest'} onPress={handleSave} disabled={isSyncing} />
                <PrimaryButton label="Next Team Member Setup" variant="secondary" onPress={clearForNextTeamMember} style={{ borderStyle: 'dashed', borderColor: primary }} />
              </View>
            )}
          </SectionCard>
        </View>
      )}

      {/* ==================== TAB 3: WRITEUP MANIFEST ==================== */}
      {screenTab === 'writeup' && (
        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Write-up (on paper)</Text>
          <Text style={[styles.body, { color: mutedText, marginBottom: Spacing.md }]}>
            Use the analytical evaluation checks below to wrap up notebook submissions inside your exercise text blocks.
          </Text>

          {[
            'Predict which fan design makes the paper move the most.',
            'Record the results.',
            'Were you right? Any surprises?',
            'How does material stiffness affect the bend angle?',
            'How does fan design influence air velocity and resulting paper movement?',
            'How does distance from the fan affect bending?',
          ].map((q, i) => (
            <View key={i} style={[styles.questionBlock, { borderTopColor: border }]}>
              <Text style={[styles.questionNumber, { color: primary }]}>{i + 1}.</Text>
              <Text style={[styles.questionText, { color: text }]}>{q}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* ==================== TAB 4: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Discussion Analysis</Text>
          <Text style={[styles.body, { color: mutedText, lineHeight: 19 }]}>
            Moving air currents transfer dynamic vector kinetic energy into static barriers. Cardboard profiles display significantly amplified $k$ stiffness coefficient parameters over basic paper fibers, layout links needing much higher air velocities to reach matched baseline spatial deformation limits.
          </Text>
        </SectionCard>
      )}

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} disabled={isSyncing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  tabPillText: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  heroTitle: { ...Typography.hero, fontSize: 24 },
  heroSubtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bodyHeading: { ...Typography.section, fontSize: 14, marginBottom: Spacing.xs },
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  experimentWrap: { gap: Spacing.md },
  infoCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  helper: { ...Typography.small },
  inputLabel: { ...Typography.small, marginBottom: 6, marginTop: Spacing.sm, fontWeight: '700' },
  inputBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, height: 40, fontSize: 13 },
  rowFields: { flexDirection: 'row', marginTop: Spacing.xs },
  videoPlayer: { width: '100%', height: 180, borderRadius: Radius.lg, marginTop: Spacing.xs },
  questionBlock: { flexDirection: 'row', gap: Spacing.sm, borderTopWidth: 1, paddingVertical: Spacing.sm, alignItems: 'flex-start' },
  questionNumber: { ...Typography.section, fontSize: 14, minWidth: 20 },
  questionText: { ...Typography.body, fontSize: 13, lineHeight: 20, flex: 1 },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, alignItems: 'center' },
  tableHeaderCell: { ...Typography.small, fontWeight: '800', fontSize: 11 },
  tableRow: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tableCell: { ...Typography.small, fontSize: 11, lineHeight: 16 },
  selectorPillRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: 2 },
  pillSelectorItem: { flex: 1, height: 36, borderWidth: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillSelectorText: { ...Typography.small, fontWeight: '700' },
  materialBlockListColumn: { gap: 6, marginVertical: 2 },
  materialRowSelector: { padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center' },
  materialRowText: { ...Typography.small, fontSize: 12 },
  physicsHUDMetricsBox: { borderWidth: 1, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.md },
  hudLabelText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hudValueText: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  actionControlRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  attemptRowListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', alignItems: 'center' }
});