import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelTitle,
  usePanelTableTokens,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import { AttemptRow } from '@/components/ui/attempt-row';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { Input } from '@/components/ui/input';
import {
  ParachuteScreenBackground,
  useParachuteScreenBackground,
} from '@/components/ui/parachute-screen-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { VideoScrubber } from '@/components/ui/video-scrubber';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import { androidPixelPressableBox, usePixelFont, withPixelFontStyle } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { uploadParachuteResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

export const options = {
  headerShown: false,
};

const GRAVITY = 9.8;
const MAX_ATTEMPTS = 3;
const VIDEO_FPS = 240;
const PARACHUTE_VISUAL = require('@/assets/images/parachute.jpeg');
const PARACHUTE_IMAGE_ASPECT = 1206 / 874;

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

const EQUIPMENT_ITEMS = [
  'Mobile phone with STEMM Lab app',
  'Small toy (e.g. army toy soldier)',
  'Table or elevated surface',
  'Paper or plastic',
  'String',
  'Scissors',
  'Tape',
];

const INSTRUCTION_STEPS = [
  'Drop the toy without a parachute and record the fall (baseline test).',
  'Build a parachute using provided materials.',
  'Drop the toy from the same height and record the fall.',
  'Review speed and landing results in the app.',
  'Redesign and test up to three prototypes within 20 minutes.',
  'Upload videos, results, and team reflections.',
];

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

type StepPanelProps = {
  step: number;
  title: string;
  colour?: ActivityCardColour;
  children: React.ReactNode;
};

function StepPanel({ step, title, colour = 'lavender', children }: StepPanelProps) {
  const { textColor, cardIconBg, borderColor } = useActivityCardColours(colour);

  return (
    <ColorPanel colour={colour}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: cardIconBg }]}>
          <Text style={[styles.stepBadgeText, { color: borderColor }]}>Step {step}</Text>
        </View>
        <Text style={[styles.stepTitle, { color: textColor }]}>{title}</Text>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </ColorPanel>
  );
}

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={withPixelFontStyle(pixelFamily, styles.heroTitle, { color: textColor })}>
      Parachute Drop
    </Text>
  );
}

function OverviewDiagramFrame() {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.heroImageWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={PARACHUTE_VISUAL}
        style={styles.heroImage}
        contentFit="contain"
        accessibilityLabel="Diagram showing parachute drop setup with height and landing zone"
      />
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

function OverviewHowToConduct() {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const error = useThemeColor({}, 'error' as any) ?? '#F44336';

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EQUIPMENT_ITEMS.map((item) => [item, false]))
  );

  const missingItems = EQUIPMENT_ITEMS.filter((item) => !checked[item]);
  const allGathered = missingItems.length === 0;
  const hasStartedSelecting = EQUIPMENT_ITEMS.some((item) => checked[item]);

  const toggleEquipment = (item: string) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  return (
    <>
      <PanelTitle>How to conduct the experiment</PanelTitle>
      <PanelMuted style={styles.equipmentIntro}>First, gather all this equipment:</PanelMuted>
      <PanelMuted style={styles.equipmentSelectHint}>
        Select all equipment you have gathered
      </PanelMuted>

      <View style={styles.equipmentChecklist}>
        {EQUIPMENT_ITEMS.map((item) => {
          const isChecked = checked[item];
          return (
            <Pressable
              key={item}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={item}
              onPress={() => toggleEquipment(item)}
              style={[
                styles.equipmentCheckRow,
                {
                  borderColor: isChecked ? success : borderColor,
                  backgroundColor: cardIconBg,
                },
              ]}>
              <MaterialIcons
                name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={isChecked ? success : borderColor}
              />
              <Text
                style={[
                  styles.equipmentCheckLabel,
                  { color: textColor, fontWeight: isChecked ? '700' : '500' },
                ]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {allGathered ? (
        <View style={[styles.equipmentStatusBanner, { backgroundColor: cardIconBg, borderColor: success }]}>
          <MaterialIcons name="celebration" size={20} color={success} />
          <Text style={[styles.equipmentStatusText, { color: success }]}>You&apos;re good to go!</Text>
        </View>
      ) : hasStartedSelecting ? (
        <View style={[styles.equipmentStatusBanner, { backgroundColor: cardIconBg, borderColor: error }]}>
          <MaterialIcons name="warning" size={20} color={error} />
          <View style={styles.missingEquipmentBlock}>
            <Text style={[styles.equipmentStatusText, { color: error }]}>Missing equipment:</Text>
            {missingItems.map((item) => (
              <Text key={item} style={[styles.missingEquipmentItem, { color: error }]}>
                • {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

function OverviewStepByStep() {
  const { textColor } = usePanelTheme();

  return (
    <>
      <PanelTitle>Step-by-step</PanelTitle>
      <Text style={[styles.stepsSectionTitle, { color: textColor }]}>Step-by-step instructions</Text>
      <OverviewInstructionList />

      <PanelMuted style={[styles.diagramCaption, { marginTop: Spacing.md }]}>
        Use the same drop height, landing zone, and camera angle for every attempt.
      </PanelMuted>
      <OverviewDiagramFrame />
    </>
  );
}

type CalculatedOutputs = {
  dropTime: number;
  contactTime: number;
  bounceTime: number | null;
  calcs: {
    finalVelocity: number;
    acceleration: number;
    netForce: number;
    weight: number;
    dragForce: number;
  };
  gForce: number;
};

type LearningTier = 'upper_primary' | 'lower_secondary';

const parseYearNumber = (raw: unknown): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const match = s.match(/(\d{1,2})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
};

const resolveLearningTier = (teamData: any | null | undefined): LearningTier => {
  // Backward-compatible: try yearLevel first (usually "4" or "Year 4"), then grade.
  const year = parseYearNumber(teamData?.yearLevel ?? teamData?.grade);
  if (year === 4 || year === 5 || year === 6) return 'upper_primary';
  if (year === 7 || year === 8 || year === 9) return 'lower_secondary';
  // Missing/unclear year defaults to Lower Secondary so we never hide science results.
  return 'lower_secondary';
};

function UpperPrimaryMarkerTool({
  uri,
  onMarkersChange,
}: {
  uri: string;
  onMarkersChange: (markers: { releaseFrame: number | null; impactFrame: number | null }) => void;
}) {
  const { textColor } = usePanelTheme();
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const onPrimary = useThemeColor({}, 'onPrimary');
  const border = useThemeColor({}, 'border');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary' as any) ?? 'rgba(0,0,0,0.04)';
  const cardIconBg = useThemeColor({}, 'cardIconBg' as any) ?? 'rgba(0,0,0,0.03)';
  const videoRef = useRef<Video>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [scrubBarWidth, setScrubBarWidth] = useState(1);
  const [markers, setMarkers] = useState<{ releaseFrame: number | null; impactFrame: number | null }>({
    releaseFrame: null,
    impactFrame: null,
  });

  const currentFrameIndex = Math.floor((positionMs / 1000) * VIDEO_FPS);
  const totalFrameCount = Math.floor((durationMs / 1000) * VIDEO_FPS);
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const seekToMs = async (ms: number) => {
    const clamped = Math.max(0, Math.min(ms, durationMs));
    await videoRef.current?.setPositionAsync(clamped, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 });
    setPositionMs(clamped);
  };

  const seekToFrame = async (frame: number) => {
    if (durationMs <= 0) return;
    const clampedFrame = Math.max(0, Math.min(frame, totalFrameCount));
    await seekToMs(Math.round((clampedFrame / VIDEO_FPS) * 1000));
  };

  const handleScrubBarPress = (x: number) => {
    if (durationMs <= 0) return;
    const ratio = Math.max(0, Math.min(x / scrubBarWidth, 1));
    void seekToMs(Math.round(ratio * durationMs));
  };

  const togglePlay = async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      if (positionMs >= durationMs - 100) await seekToMs(0);
      await videoRef.current?.setRateAsync(speed, true);
      await videoRef.current?.playAsync();
      setIsPlaying(true);
    }
  };

  const changeSpeed = async (next: number) => {
    setSpeed(next);
    if (isPlaying) await videoRef.current?.setRateAsync(next, true);
  };

  const mark = (key: 'releaseFrame' | 'impactFrame') => {
    const next = { ...markers, [key]: currentFrameIndex };
    setMarkers(next);
    onMarkersChange(next);
  };

  const clear = (key: 'releaseFrame' | 'impactFrame') => {
    const next = { ...markers, [key]: null };
    setMarkers(next);
    onMarkersChange(next);
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.primaryVideo}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        onPlaybackStatusUpdate={(status) => {
          if (!status.isLoaded) return;
          setPositionMs(status.positionMillis ?? 0);
          setDurationMs(status.durationMillis ?? 0);
          setIsPlaying(status.didJustFinish ? false : status.isPlaying);
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Timeline"
        onLayout={(e) => setScrubBarWidth(e.nativeEvent.layout.width)}
        onPress={(e) => handleScrubBarPress(e.nativeEvent.locationX)}
        style={[styles.primaryScrubBar, { backgroundColor: border }]}>
        <View style={[styles.primaryScrubFill, { width: `${progress * 100}%`, backgroundColor: primary }]} />
        {markers.releaseFrame !== null && totalFrameCount > 0 ? (
          <View
            style={[
              styles.primaryMarkerDotOnBar,
              {
                left: `${(markers.releaseFrame / totalFrameCount) * 100}%`,
                backgroundColor: primary,
              },
            ]}
          />
        ) : null}
        {markers.impactFrame !== null && totalFrameCount > 0 ? (
          <View
            style={[
              styles.primaryMarkerDotOnBar,
              {
                left: `${(markers.impactFrame / totalFrameCount) * 100}%`,
                backgroundColor: success,
              },
            ]}
          />
        ) : null}
      </Pressable>

      <PanelMuted style={{ textAlign: 'center' }}>
        Frame: {currentFrameIndex}f / {totalFrameCount}f ({(positionMs / 1000).toFixed(3)}s)
      </PanelMuted>

      <View style={styles.primaryControlRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void seekToFrame(currentFrameIndex - 10)}
          style={[styles.primaryControlBtn, { backgroundColor: cardIconBg, borderColor: border }]}>
          <Text style={[styles.primaryControlBtnText, { color: textColor }]}>《 -10f</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void togglePlay()}
          style={[styles.primaryControlBtn, { backgroundColor: primary, borderColor: primary }]}>
          <Text style={[styles.primaryControlBtnText, { color: onPrimary }]}>
            {isPlaying ? 'Pause' : positionMs >= durationMs - 100 ? 'Replay' : 'Play'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void seekToFrame(currentFrameIndex + 10)}
          style={[styles.primaryControlBtn, { backgroundColor: cardIconBg, borderColor: border }]}>
          <Text style={[styles.primaryControlBtnText, { color: textColor }]}>+10f 》</Text>
        </Pressable>
      </View>

      <View style={styles.primarySpeedRow}>
        {[
          { label: '1×', value: 1.0 },
          { label: '0.5×', value: 0.5 },
          { label: '0.25×', value: 0.25 },
        ].map((s) => {
          const selected = speed === s.value;
          return (
            <Pressable
              key={s.label}
              onPress={() => void changeSpeed(s.value)}
              style={[
                styles.primarySpeedPill,
                {
                  backgroundColor: selected ? primary : backgroundSecondary,
                  borderColor: border,
                },
              ]}>
              <Text style={[styles.primarySpeedPillText, { color: selected ? onPrimary : textColor }]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: Spacing.xs }}>
        <View style={styles.primaryMarkerRow}>
          <View style={[styles.primaryMarkerDot, { backgroundColor: primary }]} />
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Mark Release" variant="secondary" onPress={() => mark('releaseFrame')} />
          </View>
          {markers.releaseFrame !== null ? (
            <Pressable onPress={() => clear('releaseFrame')}>
              <Text style={[styles.primaryClearText, { color: textColor }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.primaryMarkerRow}>
          <View style={[styles.primaryMarkerDot, { backgroundColor: success }]} />
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Mark Impact" variant="secondary" onPress={() => mark('impactFrame')} />
          </View>
          {markers.impactFrame !== null ? (
            <Pressable onPress={() => clear('impactFrame')}>
              <Text style={[styles.primaryClearText, { color: textColor }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const getPrimaryLandingLabel = (contactTimeSec: number): string => {
  if (!Number.isFinite(contactTimeSec) || contactTimeSec <= 0) return 'Landing not measured';
  if (contactTimeSec >= 0.25) return 'Soft landing';
  if (contactTimeSec >= 0.12) return 'Okay landing';
  return 'Hard landing';
};

const getSecondaryLandingLabel = (gForce: number): string => {
  if (!Number.isFinite(gForce) || gForce <= 0) return '—';
  if (gForce <= 5) return 'Soft landing';
  if (gForce <= 10) return 'Okay landing';
  return 'Hard landing';
};

function ExperimentReviewResults({
  calculatedOutputs,
  getGForceRiskColor,
  learningTier,
  bestDropTimeSoFar,
}: {
  calculatedOutputs: CalculatedOutputs;
  getGForceRiskColor: (g: number) => string;
  learningTier: LearningTier;
  bestDropTimeSoFar: number;
}) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const valueStyle = [styles.metricValue, { color: textColor }];
  const [showExtraScience, setShowExtraScience] = useState(false);
  const isUpperPrimary = learningTier === 'upper_primary';
  const primaryLandingLabel = getPrimaryLandingLabel(calculatedOutputs.contactTime);
  const secondaryLandingLabel = getSecondaryLandingLabel(calculatedOutputs.gForce);
  const isBestAttempt =
    Number.isFinite(bestDropTimeSoFar) &&
    Math.abs(bestDropTimeSoFar - calculatedOutputs.dropTime) < 0.0005;

  return (
    <View style={[styles.calcOutputBox, { backgroundColor: cardIconBg, borderColor }]}>
      <PanelMuted style={styles.resultsDisclaimer}>
        {isUpperPrimary
          ? 'This is a simple estimate using your drop height and drop time.'
          : 'These values are estimates based on your video frame markers, drop height, mass, and contact time.'}
      </PanelMuted>

      <Text style={[styles.metricLine, { color: textColor }]}>
        Drop Time: <Text style={valueStyle}>{calculatedOutputs.dropTime}s</Text>
      </Text>
      <Text style={[styles.metricLine, { color: textColor }]}>
        Estimated Drop Speed:{' '}
        <Text style={valueStyle}>{calculatedOutputs.calcs.finalVelocity} m/s</Text>
      </Text>

      {isUpperPrimary ? (
        <>
          <Text style={[styles.metricLine, { color: textColor }]}>
            Best Attempt: <Text style={valueStyle}>{bestDropTimeSoFar}s</Text>
            {isBestAttempt ? <Text style={[valueStyle, { color: textColor }]}> (this one)</Text> : null}
          </Text>
          <Text style={[styles.metricLine, { color: textColor }]}>
            Landing Result: <Text style={valueStyle}>{primaryLandingLabel}</Text>
          </Text>
          <PanelMuted style={styles.primaryFriendlyHint}>
            Longer drop time means your parachute slowed the toy down more.
          </PanelMuted>
          <PanelMuted style={styles.primaryFriendlyHint}>
            Compare your attempts to see which design stayed in the air longest.
          </PanelMuted>

          <PrimaryButton
            label={showExtraScience ? 'Hide extra science' : 'See extra science'}
            variant="secondary"
            onPress={() => setShowExtraScience((v) => !v)}
            style={{ marginTop: Spacing.sm }}
          />
        </>
      ) : null}

      {!isUpperPrimary || showExtraScience ? (
        <>
          <Text style={[styles.metricLine, { color: textColor }]}>
            Contact Time: <Text style={valueStyle}>{calculatedOutputs.contactTime}s</Text>
          </Text>
          {calculatedOutputs.bounceTime !== null && (
            <Text style={[styles.metricLine, { color: textColor }]}>
              Time to Max Bounce Height (t_up): <Text style={valueStyle}>{calculatedOutputs.bounceTime}s</Text>
            </Text>
          )}
          <Text style={[styles.metricLine, { color: textColor }]}>
            Estimated Acceleration (a): <Text style={valueStyle}>{calculatedOutputs.calcs.acceleration} m/s²</Text>
          </Text>
          <Text style={[styles.metricLine, { color: textColor, marginTop: 4 }]}>
            Weight (Downward Force): <Text style={valueStyle}>{calculatedOutputs.calcs.weight} N</Text>
          </Text>
          <Text style={[styles.metricLine, { color: textColor }]}>
            Estimated Net Force (F_net): <Text style={valueStyle}>{calculatedOutputs.calcs.netForce} N</Text>
          </Text>
          <Text style={[styles.metricLine, { color: textColor }]}>
            Estimated Drag Force (Upward): <Text style={valueStyle}>{calculatedOutputs.calcs.dragForce} N</Text>
          </Text>
          <Text style={[styles.metricLine, { color: textColor }]}>
            Landing Result: <Text style={valueStyle}>{secondaryLandingLabel}</Text>
          </Text>
          {!isUpperPrimary ? (
            <Text style={[styles.gForceText, { color: getGForceRiskColor(calculatedOutputs.gForce) }]}>
              Impact G-Force: {calculatedOutputs.gForce} g
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = [
  'lavender',
  'sky',
  'lavender',
  'sky',
  'lavender',
  'sky',
];

function DiscussionForcesPanel({ primary }: { primary: string }) {
  return (
    <ColorPanel colour="sky">
      <DiscussionForcesContent primary={primary} />
    </ColorPanel>
  );
}

function DiscussionForcesContent({ primary }: { primary: string }) {
  const { textColor, borderColor } = usePanelTableTokens();

  return (
    <>
      <PanelTitle>Forces Acting on the Toy</PanelTitle>
      <View style={[styles.matrixTableGrid, { borderColor }]}>
        <View style={[styles.matrixHeaderRow, { borderBottomColor: borderColor }]}>
          <Text style={[styles.tableHeaderCell, { color: textColor, flex: 1 }]}>
            Vector Force Direction
          </Text>
          <Text style={[styles.tableHeaderCell, { color: textColor, flex: 1.2 }]}>
            Formula Derivation Equation
          </Text>
        </View>
        <View style={[styles.matrixDataRow, { borderBottomColor: borderColor }]}>
          <Text style={[styles.tableBodyCell, { color: textColor, flex: 1 }]}>Downward (Weight)</Text>
          <Text style={[styles.tableBodyCell, { color: primary, fontWeight: 'bold', flex: 1.2 }]}>
            Weight = mass × g
          </Text>
        </View>
        <View style={[styles.matrixDataRow, { borderBottomColor: borderColor }]}>
          <Text style={[styles.tableBodyCell, { color: textColor, flex: 1 }]}>Upward (Drag Force)</Text>
          <Text style={[styles.tableBodyCell, { color: textColor, opacity: 0.7, flex: 1.2 }]}>
            Air resistance counteraction
          </Text>
        </View>
        <View style={[styles.matrixDataRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.tableBodyCell, { color: textColor, flex: 1 }]}>Net (Total) Force</Text>
          <Text style={[styles.tableBodyCell, { color: primary, fontWeight: 'bold', flex: 1.2 }]}>
            Net Force = Weight - Drag
          </Text>
        </View>
      </View>
      <Text style={[styles.newtonLawCallout, { borderColor, color: textColor }]}>
        Newton’s Second Law: Net Force = mass × acceleration
      </Text>
    </>
  );
}

function DiscussionGForcePanel() {
  return (
    <ColorPanel colour="lavender">
      <DiscussionGForceContent />
    </ColorPanel>
  );
}

function DiscussionGForceContent() {
  const { textColor, borderColor } = usePanelTableTokens();

  return (
    <>
      <PanelTitle>G-Force and Injury Risk Analysis</PanelTitle>
      <PanelMuted style={[styles.softPanelHint, { marginBottom: Spacing.sm }]}>
        G-force describes how quickly an object decelerates on sudden impact. It is measured in
        multiples of gravity where g = 9.8 m/s².
      </PanelMuted>
      <View style={[styles.matrixTableGrid, { borderColor }]}>
        <View
          style={[
            styles.matrixHeaderRow,
            { borderBottomColor: borderColor, alignItems: 'flex-start' },
          ]}>
          <Text style={[styles.tableHeaderCell, { color: textColor, width: 85 }]}>G-Force Range</Text>
          <Text style={[styles.tableHeaderCell, { color: textColor, width: 130 }]}>Real-World Examples</Text>
          <Text style={[styles.tableHeaderCell, { color: textColor, flex: 1, flexShrink: 1 }]}>
            Likely Structural Effects
          </Text>
        </View>
        {[
          { range: '1–5 g', ex: 'Amusement park rides', effect: 'Safe; no damage risk' },
          { range: '5–10 g', ex: 'Hard dynamic running drops', effect: 'Minor deformation risk' },
          { range: '10–30 g', ex: 'Bicycle or sports crashes', effect: 'Serious stress failures' },
          { range: '30–50 g', ex: 'Falls onto solid surfaces', effect: 'Severe structural rupture' },
          { range: '50+ g', ex: 'Sudden dead stops (no cushion)', effect: 'Catastrophic destruction' },
        ].map((item, index) => (
          <View
            key={index}
            style={[
              styles.matrixDataRow,
              {
                borderBottomWidth: index === 4 ? 0 : 1,
                borderBottomColor: borderColor,
                alignItems: 'flex-start',
              },
            ]}>
            <Text style={[styles.tableBodyCell, { color: textColor, fontWeight: '700', width: 85 }]}>
              {item.range}
            </Text>
            <Text style={[styles.tableBodyCell, { color: textColor, opacity: 0.78, width: 130 }]}>
              {item.ex}
            </Text>
            <Text
              style={[
                styles.tableBodyCell,
                { color: textColor, opacity: 0.78, flex: 1, flexShrink: 1 },
              ]}>
              {item.effect}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function WriteupWorksheetTable() {
  const { textColor, borderColor } = usePanelTableTokens();
  const mutedCell = { color: textColor, opacity: 0.65, fontStyle: 'italic' as const };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.matrixTableGrid, { borderColor }]}>
          <View style={[styles.matrixHeaderRow, { borderBottomColor: borderColor }]}>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 140 }]}>
              Configuration Profile
            </Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 100 }]}>
              Predicted Time
            </Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 110 }]}>
              Drop Time (Air Time)
            </Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 90 }]}>
              Prediction Correct?
            </Text>
            <Text style={[styles.tableHeaderCell, { color: textColor, width: 140 }]}>
              Contact Stop Time (Slow-Mo)
            </Text>
          </View>
          {[
            { id: '1', label: 'Action 1: Baseline (No Parachute)' },
            { id: '2', label: 'Action 2: 4-Corner Plastic Canopy' },
            { id: '3', label: 'Action 3: Custom Prototype' },
          ].map((row, idx) => (
            <View
              key={row.id}
              style={[
                styles.matrixDataRow,
                { borderBottomWidth: idx === 2 ? 0 : 1, borderBottomColor: borderColor },
              ]}>
              <Text style={[styles.tableBodyCell, { color: textColor, fontWeight: '600', width: 140 }]}>
                {row.label}
              </Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 100 }]}>Fill on paper...</Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 110 }]}>Fill on paper...</Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 90 }]}>[  ] Y / [  ] N</Text>
              <Text style={[styles.tableBodyCell, mutedCell, { width: 140 }]}>Fill on paper...</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={[styles.fieldSubHintText, { marginTop: Spacing.xs }]}>
        All cells are for reference — fill these values directly into your physical print sheets
        during active drops.
      </Text>
    </>
  );
}

export default function ParachuteScreen() {
  const router = useRouter();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useParachuteScreenBackground();

  const scrollRef = useRef<ScrollView>(null);

  const [screenTab, setScreenTab] = useState<ScreenTab>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [locationStatus, setLocationStatus] = useState('📡 Searching...');
  const [learningTier, setLearningTier] = useState<LearningTier>('lower_secondary');

  const [attempts, setAttempts] = useState<ParachuteAttempt[]>([]);
  const [massKg, setMassKg] = useState<string>('');
  const [heightM, setHeightM] = useState<string>('');

  const [currentVideoUri, setCurrentVideoUri] = useState<string | null>(null);
  const videoFps = VIDEO_FPS;

  const [frameRelease, setFrameRelease] = useState<number | null>(null);
  const [frameImpact, setFrameImpact] = useState<number | null>(null);
  const [frameStop, setFrameStop] = useState<number | null>(null);
  const [bounceMode, setBounceMode] = useState<BounceMode>('no_bounce');
  const [frameMaxBounce, setFrameMaxBounce] = useState<number | null>(null);

  const [calculatedOutputs, setCalculatedOutputs] = useState<{
    dropTime: number;
    contactTime: number;
    bounceTime: number | null;
    calcs: ParachuteCalculations;
    gForce: number;
  } | null>(null);

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearChallengeInterval = useCallback(() => {
    if (challengeIntervalRef.current) {
      clearInterval(challengeIntervalRef.current);
      challengeIntervalRef.current = null;
    }
  }, []);

  const stopChallengeTimer = useCallback(() => {
    clearChallengeInterval();
    setChallengeTimerRunning(false);
    setChallengeTimerFinished(true);
  }, [clearChallengeInterval]);

  const scrollToTop = useCallback((animated = true) => {
    scrollRef.current?.scrollTo({ y: 0, animated });
  }, []);

  const runChallengeInterval = useCallback(() => {
    const endAt = Date.now() + challengeRemainingMs;
    challengeIntervalRef.current = setInterval(() => {
      const next = Math.max(0, endAt - Date.now());
      setChallengeRemainingMs(next);
      if (next <= 0) {
        clearChallengeInterval();
        setChallengeTimerRunning(false);
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
  }, [
    challengeRemainingMs,
    challengeTimerFinished,
    challengeTimerRunning,
    runChallengeInterval,
  ]);

  useEffect(() => () => clearChallengeInterval(), [clearChallengeInterval]);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  
  // Appended runtime casting assertions to clear type validation underlines
  const primaryDark = useThemeColor({}, 'primaryDark' as any) ?? '#6B21A8';
  const primarySoft = useThemeColor({}, 'primarySoft' as any) ?? '#F3E8FF';
  const onPrimary = useThemeColor({}, 'onPrimary');
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const warning = useThemeColor({}, 'warning' as any) ?? '#FF9800';
  const error = useThemeColor({}, 'error' as any) ?? '#F44336';

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'Fixed' : 'Off');
    })();
  }, []);

  useEffect(() => {
    let active = true;
    void getTeamData().then((teamData) => {
      if (!active) return;
      setLearningTier(resolveLearningTier(teamData));
    });
    return () => {
      active = false;
    };
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecording(false);
    }
  };

  const processFrameMathematics = () => {
    const mass = parseFloat(massKg);
    const height = parseFloat(heightM);

    if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(height) || height <= 0) {
      Alert.alert('Validation Error', 'Mass and height must be positive numbers.');
      return;
    }

    if (frameRelease === null || frameImpact === null) {
      Alert.alert('Missing frame markers', 'Mark Release and Impact frames before calculating.');
      return;
    }

    if (frameRelease >= frameImpact) {
      Alert.alert('Frame order issue', 'Release frame must be before impact frame.');
      return;
    }

    const dropTime = (frameImpact - frameRelease) / videoFps;
    const hasStopFrame = frameStop !== null;
    const contactTime = hasStopFrame ? (frameStop! - frameImpact) / videoFps : 0;

    if (dropTime <= 0) {
      Alert.alert('Data Error', 'Drop time must be greater than 0.');
      return;
    }

    if (learningTier === 'lower_secondary') {
      if (!hasStopFrame) {
        Alert.alert('Missing frame markers', 'Mark Stop frame before calculating contact time and g-force.');
        return;
      }
      if (frameImpact >= frameStop!) {
        Alert.alert('Frame order issue', 'Impact frame must be before stop frame.');
        return;
      }
      if (contactTime <= 0) {
        Alert.alert('Data Error', 'Contact time must be greater than 0.');
        return;
      }
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

    if (learningTier === 'lower_secondary') {
      if (bounceMode === 'no_bounce') {
        gForce = finalVelocity / contactTime / GRAVITY;
      } else {
        if (frameMaxBounce === null) {
          Alert.alert('Missing bounce marker', 'Bounce mode is on. Mark the peak bounce frame after impact.');
          return;
        }
        if (frameMaxBounce <= frameImpact) {
          Alert.alert('Bounce frame order issue', 'Max bounce frame must be after impact frame.');
          return;
        }
        bounceTime = (frameMaxBounce - frameImpact) / videoFps;
        const vUp = GRAVITY * bounceTime;
        const deltaV = finalVelocity + vUp;
        gForce = deltaV / contactTime / GRAVITY;
      }
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

      const elapsedMs = EXPERIMENT_CHALLENGE_LIMIT_MS - challengeRemainingMs;
      const timeSummary =
        challengeTimerStarted && elapsedMs >= 0
          ? `Time taken: ${formatDuration(elapsedMs)}`
          : `Time taken: —`;

      stopChallengeTimer();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚀 STEMM Lab Sync Complete',
          body: `Trial data for ${teamData?.name || 'your team'} saved. ${timeSummary}`,
          data: { screen: 'parachute-results' },
        },
        trigger: null,
      });

      // Redirects securely to the discrete results dashboard via query string payload
      router.push({
        pathname: '/parachute-results' as any,
        params: { attemptsJson: JSON.stringify(sanitizedAttempts) },
      });
    } catch (error) {
      console.error('Data Sync Engine Error:', error);
      Alert.alert('Sync Error', 'Cloud synchronization failed. Data preserved in local database.');
    } finally {
      setIsSyncing(false);
    }
  };

  const getGForceRiskColor = (g: number): string => {
    if (g <= 5) return success;
    if (g <= 10) return warning;
    return error;
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <ParachuteScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          ref={scrollRef}
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
                  onPress={() => {
                    setScreenTab(tab);
                    requestAnimationFrame(() => scrollToTop(true));
                  }}
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
                {pixelFontLoaded ? (
                  <OverviewHeroTitle pixelFamily={pixelFamily} />
                ) : null}
                <PanelMuted style={styles.heroSubtitle}>Engineering · Physics</PanelMuted>
                <PanelMuted style={styles.heroBody}>
                  Design, build, and test a parachute for a small toy. Slow the landing and reduce
                  impact force — then improve your design across up to three attempts.
                </PanelMuted>
              </ColorPanel>

              <ColorPanel colour="yellow">
                <OverviewHowToConduct />
              </ColorPanel>

              <ColorPanel colour="sky">
                <OverviewStepByStep />
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

              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: primarySoft }]}>
                  <MaterialIcons name="location-on" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Location: {locationStatus}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: primarySoft }]}>
                  <MaterialIcons name="science" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Attempts {attempts.length} / {MAX_ATTEMPTS}
                  </Text>
                </View>
              </View>

              <StepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Set up your drop">
                <Input
                  label="Mass of Payload toy (kg)"
                  placeholder="e.g. 0.20"
                  value={massKg}
                  onChangeText={setMassKg}
                  keyboardType="decimal-pad"
                />
                <Input
                  label="Height of drop launch platform (m)"
                  placeholder="e.g. 1.2"
                  value={heightM}
                  onChangeText={setHeightM}
                  keyboardType="decimal-pad"
                />
              </StepPanel>

              <StepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Record slow-motion drop">
                <PanelMuted style={styles.stepHint}>
                  Film each prototype drop. Mark release, impact, and stop frames in the analyser.
                </PanelMuted>
                <PrimaryButton
                  label={isRecording ? 'Awaiting System Device...' : 'Launch Camera'}
                  onPress={() => void captureVideoAsset()}
                  disabled={attempts.length >= MAX_ATTEMPTS || currentVideoUri !== null || isSyncing}
                />
              </StepPanel>

              {currentVideoUri && (
                <StepPanel step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Mark frames on timeline">
                  {learningTier === 'upper_primary' ? (
                    <UpperPrimaryMarkerTool
                      uri={currentVideoUri}
                      onMarkersChange={(m) => {
                        setFrameRelease(m.releaseFrame);
                        setFrameImpact(m.impactFrame);
                        // Upper Primary does not use stop/bounce markers.
                        setFrameStop(null);
                        setFrameMaxBounce(null);
                        setBounceMode('no_bounce');
                        setCalculatedOutputs(null);
                      }}
                    />
                  ) : (
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
                  )}
                  <PrimaryButton
                    label="Execute Physics Calculations"
                    variant="primary"
                    style={{ marginTop: Spacing.md }}
                    onPress={processFrameMathematics}
                  />
                </StepPanel>
              )}

              {calculatedOutputs && (
                <StepPanel step={4} colour={EXPERIMENT_STEP_COLOURS[3]} title="Review your results">
                  <ExperimentReviewResults
                    calculatedOutputs={calculatedOutputs}
                    getGForceRiskColor={getGForceRiskColor}
                    learningTier={learningTier}
                    bestDropTimeSoFar={Math.round(
                      Math.max(calculatedOutputs.dropTime, ...attempts.map((a) => a.dropTimeSec)) * 1000
                    ) / 1000}
                  />
                  <PrimaryButton
                    label="Save and Lock Trial Results"
                    variant="secondary"
                    style={{ borderColor: primary, marginTop: Spacing.sm }}
                    onPress={commitAttemptToLocalState}
                  />
                </StepPanel>
              )}

              <StepPanel step={5} colour={EXPERIMENT_STEP_COLOURS[4]} title="Your attempts">
                {attempts.length === 0 ? (
                  <PanelMuted style={styles.emptyHint}>
                    Awaiting valid experiment metrics updates.
                  </PanelMuted>
                ) : (
                  attempts.map((item, index) => (
                    <AttemptRow
                      key={index}
                      index={index + 1}
                      title={`Prototype Attempt ${index + 1}`}
                      subtitle={
                        learningTier === 'upper_primary'
                          ? `Air Time: ${item.dropTimeSec}s`
                          : `Air Time: ${item.dropTimeSec}s | Impact: ${item.gForce}g`
                      }
                      isLast={index === attempts.length - 1}
                    />
                  ))
                )}
                {attempts.length > 0 && (
                  <PrimaryButton
                    label={isSyncing ? 'Syncing...' : 'Upload Configuration Data'}
                    variant="primary"
                    style={{ marginTop: Spacing.md }}
                    onPress={() => void finishAndViewResults()}
                    disabled={isSyncing}
                  />
                )}
              </StepPanel>
            </View>
          )}

          {screenTab === 'writeup' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                <PanelTitle>Write-up Template</PanelTitle>
                <PanelMuted style={styles.softPanelHint}>
                  Use these questions as a guide for your physical paper lesson worksheet:
                </PanelMuted>
                <View style={styles.promptListContainer}>
                  <PanelMuted style={styles.bulletPrompt}>
                    • Predict which parachute design will perform the best.
                  </PanelMuted>
                  <PanelMuted style={styles.bulletPrompt}>
                    • Sketch each distinctive prototype layout design on paper.
                  </PanelMuted>
                  <PanelMuted style={styles.bulletPrompt}>
                    • Record the calculated flight times of each attempt configuration.
                  </PanelMuted>
                  <PanelMuted style={styles.bulletPrompt}>
                    • Were your structural predictions correct in final timings?
                  </PanelMuted>
                  <PanelMuted style={styles.bulletPrompt}>
                    • Which canopy design layout was the easiest to manufacture?
                  </PanelMuted>
                </View>
              </ColorPanel>

              <ColorPanel colour="sky">
                <PanelTitle>Worksheet Reference Table</PanelTitle>
                <WriteupWorksheetTable />
              </ColorPanel>
            </View>
          )}

          {screenTab === 'discussion' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                <PanelTitle>Discussion: Parachutes and Forces</PanelTitle>
                <PanelMuted style={styles.body}>
                  Gravity pulls objects downward, causing them to accelerate as they fall. A parachute
                  canopy increases air resistance, also called drag force.
                </PanelMuted>
                <PanelMuted style={[styles.body, { marginTop: Spacing.xs }]}>
                  Drag acts upward, opposing the fall. A slower landing speed reduces the sudden shock
                  when the toy hits the surface — a safer landing for your payload.
                </PanelMuted>
              </ColorPanel>

              <DiscussionForcesPanel primary={primary} />

              <DiscussionGForcePanel />

              <ColorPanel colour="sky">
                <PanelTitle>Curriculum Links</PanelTitle>
                <PanelMuted style={styles.bullet}>
                  • Science (Physics): forces, motion, and energy in falling objects.
                </PanelMuted>
                <PanelMuted style={[styles.bullet, { marginTop: 2 }]}>
                  • Design & Technologies: iterative prototyping and testing under constraints.
                </PanelMuted>
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
                  style={{ marginTop: Spacing.sm }}
                />
              ) : null}
              <PrimaryButton
                label="Back to dashboard"
                variant="secondary"
                onPress={() => router.back()}
                disabled={isSyncing}
                style={{ marginTop: Spacing.sm }}
              />
            </>
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
    aspectRatio: PARACHUTE_IMAGE_ASPECT,
  },
  primaryVideo: {
    width: '100%',
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: '#000',
  },
  primaryScrubBar: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'visible',
    position: 'relative',
  },
  primaryScrubFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  primaryMarkerDotOnBar: {
    position: 'absolute',
    top: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    borderWidth: 2,
    borderColor: '#fff',
  },
  primaryControlRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryControlBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  primaryControlBtnText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  primarySpeedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  primarySpeedPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  primarySpeedPillText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  primaryMarkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  primaryMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  primaryClearText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  overviewActions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  softPanelTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  softPanelHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  equipmentIntro: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: FontWeight.semibold,
  },
  equipmentSelectHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
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
  sectionDivider: {
    height: 2,
    opacity: 0.35,
    marginVertical: Spacing.md,
  },
  stepsSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
  },
  instructionNum: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNumText: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  instructionText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  stepHeader: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  stepTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  stepBody: {
    gap: Spacing.md,
  },
  stepHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
  },
  calcOutputBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 4,
  },
  resultsDisclaimer: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.85,
    marginBottom: Spacing.xs,
  },
  primaryFriendlyHint: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
  },
  metricLine: {
    fontSize: 13,
    lineHeight: 20,
  },
  metricValue: {
    fontFamily: 'monospace',
    fontWeight: FontWeight.bold,
  },
  gForceText: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'monospace',
    marginTop: Spacing.sm,
  },
  emptyHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  promptListContainer: {
    gap: 6,
    marginVertical: Spacing.xs,
    paddingLeft: 4,
  },
  bulletPrompt: {
    fontSize: 13,
    lineHeight: 18,
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
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  tableBodyCell: {
    fontSize: 12,
    lineHeight: 16,
  },
  newtonLawCallout: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    textAlign: 'center',
    fontWeight: FontWeight.bold,
    fontSize: 13,
  },
  fieldSubHintText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  bullet: {
    fontSize: 13,
    lineHeight: 19,
  },
});