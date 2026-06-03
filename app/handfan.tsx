import { ActivityStepPanel } from '@/components/activity/ActivityStepPanel';
import { EquipmentChecklist } from '@/components/activity/EquipmentChecklist';
import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelText,
  PanelTitle,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import { AttemptRow } from '@/components/ui/attempt-row';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { HandFanScreenBackground, useHandFanScreenBackground } from '@/components/ui/handfan-screen-background';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { formatDuration } from '@/utils/formatters/duration';
import { insertTrial } from '@/hooks/database';
import { androidPixelPressableBox, usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useBatteryTracker } from '@/hooks/useBatteryTracker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { scheduleAppNotification } from '@/hooks/notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { uploadHandFanResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

const HAND_FAN_DIAGRAM = require('@/assets/images/handfan-diagram.jpeg');
const HAND_FAN_DIAGRAM_ASPECT = 680 / 382;

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = ['lavender', 'sky', 'lavender'];

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Hand Fan Challenge
    </Text>
  );
}

function HandFanDiagramFrame() {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.diagramWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={HAND_FAN_DIAGRAM}
        style={styles.diagramImage}
        contentFit="contain"
        accessibilityLabel="Diagram showing hand fan setup with paper strip and distance"
      />
    </View>
  );
}

function OverviewEquipmentChecklist() {
  return <EquipmentChecklist items={EQUIPMENT_ITEMS} variant="compact" />;
}

type ScreenTab = 'overview' | 'experiment' | 'writeup' | 'discussion';

const SCREEN_TABS: ScreenTab[] = ['overview', 'experiment', 'writeup', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  overview: 'Overview',
  experiment: 'Experiment',
  writeup: 'Write-up',
  discussion: 'Discussion',
};

export const options = {
  headerShown: false,
};

const EQUIPMENT_ITEMS = [
  'Paper and cardboard',
  'Scissors',
  'Mobile phone',
  'Sticky tape',
  'STEMM Lab app',
] as const;

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
  const { getOptimizedLocation } = useBatteryTracker();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useHandFanScreenBackground();

  const scrollRef = useRef<ScrollView>(null);

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Searching...');

  const [memberName, setMemberName] = useState('');
  const [attempts, setAttempts] = useState<DesignTrial[]>([]);

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
  const primaryDark = useThemeColor({}, 'primaryDark');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary');
  const onPrimary = useThemeColor({}, 'onPrimary' as any) ?? '#FFFFFF';

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearChallengeInterval = useCallback(() => {
    if (challengeIntervalRef.current) clearInterval(challengeIntervalRef.current);
    challengeIntervalRef.current = null;
  }, []);

  const runChallengeInterval = useCallback(() => {
    clearChallengeInterval();
    const endAt = Date.now() + challengeRemainingMs;
    challengeIntervalRef.current = setInterval(() => {
      const next = Math.max(0, endAt - Date.now());
      setChallengeRemainingMs(next);
      if (next <= 0) {
        clearChallengeInterval();
        setChallengeTimerRunning(false);
        setChallengeTimerFinished(true);
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
  }, [challengeRemainingMs, challengeTimerFinished, challengeTimerRunning, runChallengeInterval]);

  const stopChallengeTimer = useCallback(() => {
    clearChallengeInterval();
    setChallengeTimerStarted(false);
    setChallengeTimerRunning(false);
    setChallengeTimerFinished(true);
    setChallengeRemainingMs(0);
  }, [clearChallengeInterval]);

  const scrollToTop = useCallback((animated = true) => {
    scrollRef.current?.scrollTo({ y: 0, animated });
  }, []);

  useEffect(() => () => clearChallengeInterval(), [clearChallengeInterval]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

  const computedForceOutput = useMemo(() => {
    const angleDegrees = parseFloat(bendAngleText);
    if (isNaN(angleDegrees) || angleDegrees <= 0) return null;

    const radians = angleDegrees * (Math.PI / 180);
    const materialK = MATERIALS_LIST[selectedMaterialIndex].k;
    const rawForce = materialK * radians;
    
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
        locationData = await getOptimizedLocation();       
      }
      const teamData = await getTeamData();
      const maxForceRecord = Math.max(...attempts.map((d) => d.computedForceN || 0));

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

      const elapsedMs = EXPERIMENT_CHALLENGE_LIMIT_MS - challengeRemainingMs;
      const timeSummary =
        challengeTimerStarted && elapsedMs >= 0
          ? `Time taken: ${formatDuration(elapsedMs)}`
          : `Time taken: —`;

      stopChallengeTimer();

      await scheduleAppNotification({
        title: 'STEMM Lab Sync Complete',
        body: `Hand Fan results for ${teamData?.name || 'your team'} have been saved! ${timeSummary}`,
        data: { screen: 'handfan-results' },
      });

      Alert.alert('Saved Successfully!', `All group lab assets are uploaded into the cloud dashboard.\n\n${timeSummary}`, [
        { 
          text: 'OK', 
          onPress: () => {
            router.push({
              pathname: '/handfan-results' as any,
              params: { attemptsJson: JSON.stringify(attempts) },
            });
          } 
        },
      ]);
    } catch (error) {
      console.error('Hand Fan Save Error:', error);
      Alert.alert('Save Error', 'Connection issue dropped storage manifest pipeline syncing updates.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <HandFanScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <ScreenBackButton />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {SCREEN_TABS.map((tab) => {
              const isActiveTab = screenTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => {
                    setScreenTab(tab);
                    requestAnimationFrame(() => scrollToTop(true));
                  }}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: isActiveTab ? primary : primarySoft,
                      borderColor: isActiveTab ? primary : border,
                    },
                  ]}>
                  <Text style={[styles.tabPillText, { color: isActiveTab ? onPrimary : primary }]}>
                    {SCREEN_TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {screenTab === 'overview' && (
        <View style={styles.tabContent}>
          <ColorPanel colour="lavender">
            {pixelFontLoaded ? <OverviewHeroTitle pixelFamily={pixelFamily} /> : <PanelTitle>Hand Fan Challenge</PanelTitle>}
            <PanelMuted style={styles.heroSubtitle}>Physics · Air Movement</PanelMuted>
            <PanelMuted style={styles.heroBody}>
              Students test how air movement affects flexible materials. By designing and using hand fans, teams discover how air force, material stiffness, and distance affect how much a paper strip bends.
            </PanelMuted>
          </ColorPanel>

          <ColorPanel colour="yellow">
            <PanelTitle>Equipment checklist</PanelTitle>
            <OverviewEquipmentChecklist />
          </ColorPanel>

          <ColorPanel colour="sky">
            <PanelTitle>Step-by-step</PanelTitle>
            {[
              'Stand paper upright on a table.',
              'Fan air from 30 cm away.',
              'Observe and record the bend angle.',
              'Repeat with different fan designs.',
              'Repeat at distances of 15cm, 30cm, and 45cm.',
              'Repeat with cardboard instead of paper.',
            ].map((step, i) => (
              <PanelMuted key={step} style={styles.bulletPrompt}>
                {i + 1}. {step}
              </PanelMuted>
            ))}
            <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>Setup diagram</PanelMuted>
            <HandFanDiagramFrame />
          </ColorPanel>

          <View style={styles.overviewActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setScreenTab('experiment');
                requestAnimationFrame(() => scrollToTop(true));
              }}
              style={[
                styles.heroCta,
                androidPixelPressableBox(),
                {
                  backgroundColor: primary,
                  borderColor: primary,
                  borderBottomColor: primaryDark,
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                },
              ]}>
              <Text
                style={withPixelFontStyle(
                  pixelFontLoaded ? pixelFamily : undefined,
                  styles.heroCtaText,
                  { color: onPrimary, textAlign: 'center' }
                )}>
                ▶  Start experiment
              </Text>
            </Pressable>
            <PrimaryButton
              label="Back to dashboard"
              variant="secondary"
              onPress={() => router.back()}
              disabled={isSyncing}
            />
          </View>
        </View>
      )}

      {/* ==================== TAB 2: ACTIVE EXPERIMENT MODELLING ==================== */}
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

          <ActivityStepPanel variant="inline" step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Set up participant">
            <Input
              label="Student name"
              placeholder="Enter student name"
              value={memberName}
              onChangeText={setMemberName}
            />
            <PanelMuted style={styles.helper}>GPS Module Lock: {locationStatus}</PanelMuted>
          </ActivityStepPanel>

          <ActivityStepPanel variant="inline" step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Log trial parameters">
            <Input
              label="Fan design label"
              placeholder="e.g. 1cm Accordion Folds"
              value={designName}
              onChangeText={setDesignName}
            />

            <PanelMuted style={styles.fieldLabel}>Wind distance boundary</PanelMuted>
            <View style={styles.selectorPillRow}>
              {DISTANCES_LIST.map((dist) => {
                const isChosen = selectedDistance === dist;
                return (
                  <TouchableOpacity
                    key={dist}
                    onPress={() => setSelectedDistance(dist as any)}
                    style={[
                      styles.pillSelectorItem,
                      {
                        backgroundColor: isChosen ? primary : backgroundSecondary,
                        borderColor: isChosen ? primary : border,
                      },
                    ]}>
                    <Text style={[styles.pillSelectorText, { color: isChosen ? onPrimary : text }]}>
                      {dist}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <PanelMuted style={styles.fieldLabel}>Standing target paper material</PanelMuted>
            <View style={styles.materialBlockListColumn}>
              {MATERIALS_LIST.map((mat, index) => {
                const isChosen = selectedMaterialIndex === index;
                return (
                  <TouchableOpacity
                    key={mat.label}
                    onPress={() => setSelectedMaterialIndex(index)}
                    style={[
                      styles.materialRowSelector,
                      {
                        backgroundColor: isChosen ? primary : backgroundSecondary,
                        borderColor: isChosen ? primary : border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.materialRowText,
                        { color: isChosen ? onPrimary : text, fontWeight: isChosen ? '700' : '400' },
                      ]}>
                      {mat.label} (k = {mat.k})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Observed bend angle (°)"
              placeholder="e.g. 30"
              keyboardType="numeric"
              value={bendAngleText}
              onChangeText={setBendAngleText}
            />

            {computedForceOutput !== null ? (
              <View style={[styles.physicsHUDMetricsBox, { borderColor: primary }]}>
                <PanelMuted style={styles.hudLabelText}>COMPUTED AERODYNAMIC DRAG FORCE</PanelMuted>
                <Text style={[styles.hudValueText, { color: primary }]}>{computedForceOutput} N</Text>
              </View>
            ) : null}

            <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
              <PrimaryButton
                label={recordedVideoUri ? '🎬 Re-record Trial Motion' : '📹 Record Trial Motion'}
                variant="secondary"
                onPress={recordVideo}
              />
              {recordedVideoUri ? (
                <Video
                  source={{ uri: recordedVideoUri }}
                  style={[styles.videoPlayer, { borderColor: border, borderWidth: 1 }]}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                />
              ) : null}
            </View>

            <View style={styles.actionControlRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Log current trial" onPress={logCurrentTrialToManifest} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Reset form" variant="secondary" onPress={clearActiveFormInputs} />
              </View>
            </View>
          </ActivityStepPanel>

          <ActivityStepPanel variant="inline" step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Your results">
            {attempts.length === 0 ? (
              <PanelMuted>No experimental vectors stored down inside this sequence yet.</PanelMuted>
            ) : (
              <View style={styles.attemptsWrap}>
                {attempts.map((item, index) => (
                  <AttemptRow
                    key={`${index}-${item.memberName}-${item.designName}`}
                    index={index + 1}
                    title={`${item.memberName} — ${item.designName}`}
                    subtitle={`Material: ${item.materialLabel} · Dist: ${item.distance} · ${item.bendAngleDeg}° · ${item.computedForceN ?? 0} N`}
                    isLast={index === attempts.length - 1}
                  />
                ))}
              </View>
            )}

            {attempts.length > 0 ? (
              <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                <PrimaryButton
                  label={isSyncing ? 'Syncing...' : 'Upload complete manifest'}
                  onPress={handleSave}
                  disabled={isSyncing}
                />
                <PrimaryButton
                  label="Next team member setup"
                  variant="secondary"
                  onPress={clearForNextTeamMember}
                  style={{ borderStyle: 'dashed', borderColor: primary }}
                />
              </View>
            ) : null}
          </ActivityStepPanel>
        </View>
      )}

      {/* ==================== TAB 3: WRITEUP MANIFEST ==================== */}
      {screenTab === 'writeup' && (
        <View style={styles.tabContent}>
          <ColorPanel colour="lavender">
            <PanelTitle>Write-up prompts</PanelTitle>
            <PanelMuted style={styles.bodyMuted}>
              Use the analytical evaluation checks below to wrap up notebook submissions inside your exercise text blocks.
            </PanelMuted>

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
              <PanelText style={styles.questionText}>{q}</PanelText>
            </View>
          ))}
          </ColorPanel>
        </View>
      )}

      {/* ==================== TAB 4: DISCUSSION ==================== */}
      {screenTab === 'discussion' && (
        <View style={styles.tabContent}>
          <ColorPanel colour="sky">
            <PanelTitle>Discussion analysis</PanelTitle>
            <PanelMuted style={styles.bodyMuted}>
              Moving air currents transfer dynamic vector kinetic energy into static barriers. Cardboard profiles display significantly amplified $k$ stiffness coefficient parameters over basic paper fibers, layout links needing much higher air velocities to reach matched baseline spatial deformation limits.
            </PanelMuted>
          </ColorPanel>

          <ColorPanel colour="mint">
            <PanelTitle>Curriculum links</PanelTitle>
            <PanelMuted style={styles.bulletPrompt}>• Science — ACSSU076: Forces and motion</PanelMuted>
          </ColorPanel>

          <ColorPanel colour="lavender">
            <PanelTitle>Calculations framework</PanelTitle>
            <PanelMuted style={styles.bodyMuted}>
              Approximate force dynamically using \(F \\approx k \\cdot \\theta\) where:
            </PanelMuted>
            <PanelMuted style={styles.bulletPrompt}>• \(F\) = force applied in Newtons (N)</PanelMuted>
            <PanelMuted style={styles.bulletPrompt}>• \(\u03B8\) = bend angle converted into radians</PanelMuted>
            <PanelMuted style={styles.bulletPrompt}>• \(k\) = material stiffness resistance parameter</PanelMuted>

            <PanelMuted style={[styles.bodyMuted, { marginTop: Spacing.md }]}>
              Material stiffness constants reference
            </PanelMuted>
            <View style={[styles.table, { borderColor: border }]}>
              <View style={[styles.tableHeaderRow, { borderBottomColor: border }]}>
                {['Material', 'Thick (mm)', 'k (N/rad)'].map((h) => (
                  <PanelText key={h} style={[styles.tableHeaderCell, { flex: 1 }]}>
                    {h}
                  </PanelText>
                ))}
              </View>
              {MATERIALS_LIST.map((row, i) => (
                <View
                  key={row.label}
                  style={[
                    styles.tableRow,
                    { backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.18)', borderBottomColor: border },
                  ]}>
                  <PanelText style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>{row.label}</PanelText>
                  <PanelText subdued style={[styles.tableCell, { flex: 1 }]}>
                    {row.thickness}
                  </PanelText>
                  <Text style={[styles.tableCell, { color: primary, flex: 1, fontWeight: '700' }]}>{row.k}</Text>
                </View>
              ))}
            </View>
          </ColorPanel>
        </View>
      )}

      {screenTab !== 'overview' && (
        <>
          {screenTab === 'experiment' ? (
            <PrimaryButton
              label="Go to write-up"
              variant="secondary"
              onPress={() => {
                setScreenTab('writeup');
                requestAnimationFrame(() => scrollToTop(true));
              }}
              disabled={isSyncing}
            />
          ) : null}
          <PrimaryButton
            label="Back to dashboard"
            variant="secondary"
            onPress={() => router.back()}
            disabled={isSyncing}
          />
        </>
      )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    paddingBottom: SCREEN_BOTTOM_INSET,
  },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  tabRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  tabPill: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  tabContent: { gap: Spacing.lg },

  heroTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  heroSubtitle: { marginTop: Spacing.xs, fontSize: 12, opacity: 0.85 },
  heroBody: { marginTop: Spacing.sm, fontSize: 13, lineHeight: 18, opacity: 0.85 },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
  },
  heroCtaText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  overviewActions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  bodyMuted: { fontSize: 13, lineHeight: 19, opacity: 0.88 },
  bulletPrompt: { fontSize: 13, lineHeight: 19, opacity: 0.88, marginTop: 6 },
  equipmentSelectHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
    fontWeight: FontWeight.semibold,
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

  diagramWrap: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: Spacing.sm,
  },
  diagramImage: { width: '100%', aspectRatio: HAND_FAN_DIAGRAM_ASPECT },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  stepBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  stepTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  stepBody: { gap: Spacing.sm },

  helper: { fontSize: 12, opacity: 0.85 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, opacity: 0.9, marginTop: 4 },

  selectorPillRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: 2 },
  pillSelectorItem: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelectorText: { fontSize: 12, fontWeight: '800' },
  materialBlockListColumn: { gap: 6, marginVertical: 2 },
  materialRowSelector: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm },
  materialRowText: { fontSize: 12 },

  physicsHUDMetricsBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  hudLabelText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, opacity: 0.85 },
  hudValueText: { fontSize: 24, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] },

  videoPlayer: { width: '100%', height: 180, borderRadius: Radius.lg, marginTop: Spacing.xs },
  actionControlRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },

  attemptsWrap: { gap: Spacing.xs },

  questionBlock: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'flex-start',
  },
  questionNumber: { fontSize: 14, fontWeight: '900', minWidth: 20 },
  questionText: { fontSize: 13, lineHeight: 20, flex: 1, fontWeight: '600' },

  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableHeaderCell: { fontSize: 11, fontWeight: '900' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  tableCell: { fontSize: 11, lineHeight: 16 },
});