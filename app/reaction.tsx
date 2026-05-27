import { type ActivityCardColour, useActivityCardColours } from '@/components/ui/activity-card';
import {
  ColorPanel,
  PanelMuted,
  PanelTitle,
  usePanelTheme,
} from '@/components/ui/activity-color-panel';
import { AttemptRow } from '@/components/ui/attempt-row';
import {
  EXPERIMENT_CHALLENGE_LIMIT_MS,
  ExperimentChallengeTimer,
} from '@/components/ui/experiment-challenge-timer';
import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import {
  ReactionScreenBackground,
  useReactionScreenBackground,
} from '@/components/ui/reaction-screen-background';
import { FontSize, FontWeight, Radius, SCREEN_BOTTOM_INSET, Spacing } from '@/constants/design';
import { uploadReactionResult } from '@/hooks/firestore';
import { usePixelFont } from '@/hooks/use-pixel-font';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  type GestureResponderHandlers,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

export const options = {
  headerShown: false,
};

const REACTION_PHASE3_DIAGRAM = require('@/assets/images/reaction-phase3.jpeg');
const REACTION_PHASE3_ASPECT = 418 / 274;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTIVITY_REACTION = 'reaction';
const ROUND_DURATION_MS = 60000; 

const TARGET_SPAWN_INTERVAL_MS = 1400; 
const TARGET_LIFESPAN_MS = 2400; 

const BOARD_SIZE = Math.min(SCREEN_WIDTH - 40, 340);
const GRID_CELL_SIZE = 70; 

const TRACE_DURATION_MS = 10000; // 10 seconds total for a complete tracing loop circuit
const TARGET_SIZE = 44; // Made larger for a better physical touch footprint

type ScreenTab = 'instructions' | 'activity' | 'discussion';
type ActivityPhase = 1 | 2 | 3;

interface ExtendedReactionAttempt {
  memberName: string;
  phase: ActivityPhase;
  reactionTime?: number;      
  accuracyPercent?: number;   
  delayMs?: number;           
  totalHits?: number;         
}

const SCREEN_TABS: ScreenTab[] = ['instructions', 'activity', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  instructions: 'Instructions',
  activity: 'Activity',
  discussion: 'Discussion',
};

const PHASE_LABELS: Record<ActivityPhase, string> = {
  1: 'Phase 1 — Tap reaction grid (dominant hand)',
  2: 'Phase 2 — Swap hands (non-dominant)',
  3: 'Phase 3 — Neuromuscular tracing',
};

const PHASE_1_STEPS = [
  'Use your dominant hand.',
  'Tap each circle as soon as it lights up on the grid.',
  'Score as many hits as you can in 60 seconds.',
];

const PHASE_2_STEPS = [
  'Switch to your non-dominant hand.',
  'Same rules as Phase 1 — tap every lit circle.',
  'Compare your average reaction time with Phase 1.',
];

const PHASE_3_STEPS = [
  'Press Start and keep your finger on the moving target.',
  'Follow the beacon along the path for the full 10-second trace.',
  'The app records accuracy % and tracking delay.',
];

const EQUIPMENT_ITEMS = [
  'Mobile phone with STEMM Lab app',
  'Flat table or surface for the reaction board',
];

const INSTRUCTION_STEPS = [
  'Gather equipment and open the Activity tab.',
  'Complete Phase 1 with your dominant hand on the tap grid.',
  'Complete Phase 2 with your non-dominant hand.',
  'Complete Phase 3 by tracing the moving target for 10 seconds.',
  'Upload all trial records when your team is finished.',
];

const EXPERIMENT_STEP_COLOURS: ActivityCardColour[] = ['lavender', 'sky', 'lavender'];

const GRID_CELL_COUNT = 9;

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

const formatTrialSubtitle = (item: ExtendedReactionAttempt): string => {
  if (item.phase === 3) {
    return `Accuracy ${item.accuracyPercent}% · lag ${item.delayMs}ms`;
  }
  return `Avg ${item.reactionTime}ms · ${item.totalHits ?? 0} hits`;
};

const hasAllPhasesRecorded = (trialAttempts: ExtendedReactionAttempt[]): boolean => {
  const phases = new Set(trialAttempts.map((a) => a.phase));
  return phases.has(1) && phases.has(2) && phases.has(3);
};

function OverviewHeroTitle({ pixelFamily }: { pixelFamily: string | undefined }) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={[styles.heroTitle, { color: textColor, fontFamily: pixelFamily }]}>
      Reaction Board Challenge
    </Text>
  );
}

function InstructionStepList({ steps }: { steps: string[] }) {
  const { textColor, cardIconBg, borderColor } = usePanelTheme();
  return (
    <>
      {steps.map((step, index) => (
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

function Phase3DiagramFrame() {
  const { borderColor, cardIconBg } = usePanelTheme();
  return (
    <View style={[styles.heroImageWrap, { borderColor, backgroundColor: cardIconBg }]}>
      <Image
        source={REACTION_PHASE3_DIAGRAM}
        style={styles.heroImage}
        contentFit="contain"
        accessibilityLabel="Diagram showing finger tracing the moving target in phase 3"
      />
    </View>
  );
}

function PhaseActivityGuide({ phase }: { phase: ActivityPhase }) {
  const steps = phase === 1 ? PHASE_1_STEPS : phase === 2 ? PHASE_2_STEPS : PHASE_3_STEPS;
  const { textColor, borderColor } = usePanelTheme();

  return (
    <>
      <Text style={[styles.phaseGuideTitle, { color: textColor }]}>{PHASE_LABELS[phase]}</Text>
      <InstructionStepList steps={steps} />
      {phase === 3 ? <Phase3DiagramFrame /> : null}
      <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />
    </>
  );
}

function OverviewConductExperiment() {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const success = useThemeColor({}, 'success');
  const error = useThemeColor({}, 'error');

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
      <PanelTitle>How to conduct the activity</PanelTitle>
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

      <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />

      <Text style={[styles.stepsSectionTitle, { color: textColor }]}>Overview</Text>
      <InstructionStepList steps={INSTRUCTION_STEPS} />

      <Text style={[styles.stepsSectionTitle, { color: textColor, marginTop: Spacing.md }]}>
        {PHASE_LABELS[1]}
      </Text>
      <InstructionStepList steps={PHASE_1_STEPS} />

      <Text style={[styles.stepsSectionTitle, { color: textColor, marginTop: Spacing.md }]}>
        {PHASE_LABELS[2]}
      </Text>
      <InstructionStepList steps={PHASE_2_STEPS} />

      <Text style={[styles.stepsSectionTitle, { color: textColor, marginTop: Spacing.md }]}>
        {PHASE_LABELS[3]}
      </Text>
      <InstructionStepList steps={PHASE_3_STEPS} />
      <Phase3DiagramFrame />
    </>
  );
}

type ReactionRoundArenaProps = {
  activePhase: ActivityPhase;
  roundActive: boolean;
  timeLeftMs: number;
  timeBarWidthPercent: string;
  liveAccuracy: number | null;
  activeCellIndices: number[];
  targetPos: { x: number; y: number };
  lastMetricsText: string;
  panHandlers: GestureResponderHandlers;
  onArenaLayout: (pageX: number, pageY: number) => void;
  onCellTap: (index: number) => void;
  onStartRound: () => void;
  onResetRound: () => void;
  onNextMember: () => void;
};

function ReactionRoundArena({
  activePhase,
  roundActive,
  timeLeftMs,
  timeBarWidthPercent,
  liveAccuracy,
  activeCellIndices,
  targetPos,
  lastMetricsText,
  panHandlers,
  onArenaLayout,
  onCellTap,
  onStartRound,
  onResetRound,
  onNextMember,
}: ReactionRoundArenaProps) {
  const { cardIconBg, borderColor, textColor } = usePanelTheme();
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');

  return (
    <>
      <PhaseActivityGuide phase={activePhase} />

      {(activePhase === 1 || activePhase === 2) && roundActive && (
        <View style={[styles.timerTrackField, { backgroundColor: cardIconBg }]}>
          <View
            style={[
              styles.timerProgressBarFill,
              { width: timeBarWidthPercent as `${number}%`, backgroundColor: primary },
            ]}
          />
          <Text style={[styles.timerPercentageText, { color: borderColor }]}>
            Time remaining: {Math.ceil(timeLeftMs / 1000)}s
          </Text>
        </View>
      )}

      {activePhase === 3 && roundActive && (
        <View style={[styles.liveMetricsHUD, { borderColor, backgroundColor: cardIconBg }]}>
          <PanelMuted style={styles.hudLabel}>Live accuracy</PanelMuted>
          <Text style={[styles.hudValue, { color: borderColor }]}>
            {liveAccuracy !== null ? `${liveAccuracy}%` : '0%'}
          </Text>
        </View>
      )}

      {(activePhase === 1 || activePhase === 2) && (
        <View
          style={[
            styles.gridTestingMatrix,
            { width: BOARD_SIZE, height: BOARD_SIZE, borderColor },
          ]}>
          {Array.from({ length: GRID_CELL_COUNT }).map((_, i) => {
            const isTarget = activeCellIndices.includes(i);
            return (
              <TouchableOpacity
                key={i}
                disabled={!roundActive || !isTarget}
                onPress={() => onCellTap(i)}
                style={[
                  styles.gridCellElement,
                  {
                    width: GRID_CELL_SIZE,
                    height: GRID_CELL_SIZE,
                    backgroundColor: isTarget ? primary : cardIconBg,
                    borderColor: isTarget ? primary : border,
                    borderRadius: GRID_CELL_SIZE / 2,
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {activePhase === 3 && (
        <View
          {...panHandlers}
          onLayout={(e) => {
            e.target.measure((_x, _y, _w, _h, pageX, pageY) => {
              onArenaLayout(pageX, pageY);
            });
          }}
          style={[
            styles.gridTestingMatrix,
            {
              width: BOARD_SIZE,
              height: BOARD_SIZE,
              borderColor,
              backgroundColor: cardIconBg,
            },
          ]}>
          <View
            style={[
              styles.tracingTargetNode,
              {
                left: targetPos.x,
                top: targetPos.y,
                backgroundColor: primary,
                shadowColor: primary,
              },
            ]}
          />
          {!roundActive && (
            <Text style={[styles.tracingPlaceholderText, { color: textColor, opacity: 0.6 }]}>
              Hold & drag finger here
            </Text>
          )}
        </View>
      )}

      {lastMetricsText ? (
        <Text style={[styles.metricsSummaryOutputText, { color: borderColor }]}>{lastMetricsText}</Text>
      ) : null}

      <View style={styles.actionControlRow}>
        <View style={styles.actionHalf}>
          <PrimaryButton
            label={roundActive ? 'Running...' : 'Start round'}
            onPress={onStartRound}
            disabled={roundActive}
          />
        </View>
        <View style={styles.actionHalf}>
          <PrimaryButton label="Reset round" variant="secondary" onPress={onResetRound} />
        </View>
      </View>

      {!roundActive && (
        <TouchableOpacity
          style={[styles.nextMemberButton, { borderColor, backgroundColor: cardIconBg }]}
          onPress={onNextMember}>
          <MaterialIcons name="person-add" size={16} color={borderColor} />
          <Text style={[styles.nextMemberButtonText, { color: borderColor }]}>Next team member</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

export default function ReactionScreen() {
  const router = useRouter();
  const { loaded: pixelFontLoaded, family: pixelFamily } = usePixelFont();
  const { overlayColor, imageOpacity } = useReactionScreenBackground();

  const [screenTab, setScreenTab] = useState<ScreenTab>('instructions');
  const [activePhase, setActivePhase] = useState<ActivityPhase>(1);
  const [memberName, setMemberName] = useState('');
  const [attempts, setAttempts] = useState<ExtendedReactionAttempt[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [roundActive, setRoundActive] = useState(false);
  const [activeCellIndices, setActiveCellIndices] = useState<number[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const [lastMetricsText, setLastMetricsText] = useState('');

  const [challengeTimerStarted, setChallengeTimerStarted] = useState(false);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const [challengeTimerFinished, setChallengeTimerFinished] = useState(false);
  const [challengeRemainingMs, setChallengeRemainingMs] = useState(EXPERIMENT_CHALLENGE_LIMIT_MS);
  const challengeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tracing State Variables
  const [targetPos, setTargetPos] = useState({ x: BOARD_SIZE / 2, y: BOARD_SIZE / 2 });
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);

  const fingerPosRef = useRef({ x: 0, y: 0 });
  const traceMetricsRef = useRef({ totalSamples: 0, matchingSamples: 0, accumulatedDelayMs: 0 });
  const arenaLayoutRef = useRef({ x: 0, y: 0 }); // Tracks where the board sits on screen dynamically
  
  const currentRoundDeltasRef = useRef<number[]>([]);
  const cellSpawnTimesRef = useRef<Record<number, number>>({});
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const traceAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const primaryDark = useThemeColor({}, 'primaryDark');
  const primarySoft = useThemeColor({}, 'primarySoft');
  const onPrimary = useThemeColor({}, 'onPrimary');
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

  const resetRoundState = (): void => {
    setRoundActive(false);
    setActiveCellIndices([]);
    setTimeLeftMs(ROUND_DURATION_MS);
    setLastMetricsText('');
    setLiveAccuracy(null);
    setScrollEnabled(true);
    currentRoundDeltasRef.current = [];
    cellSpawnTimesRef.current = {};
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    if (traceAnimationRef.current) clearInterval(traceAnimationRef.current);
  };

  const handleCellTap = (index: number) => {
    if (!roundActive || !activeCellIndices.includes(index)) return;

    const spawnTime = cellSpawnTimesRef.current[index] || Date.now();
    const delta = Date.now() - spawnTime;
    const currentName = memberName.trim();

    // Push reaction time quietly into tracking reference array
    currentRoundDeltasRef.current.push(delta);

    setActiveCellIndices((prev) => prev.filter((id) => id !== index));
    delete cellSpawnTimesRef.current[index];
  };

  const prepNextTeamMemberAttempt = (): void => {
    resetRoundState();
    setMemberName('');
  };

  const startMultiTargetGridLoop = () => {
    spawnIntervalRef.current = setInterval(() => {
      setActiveCellIndices((prev) => {
        const availableCells = Array.from({ length: GRID_CELL_COUNT })
          .map((_, i) => i)
          .filter((i) => !prev.includes(i));
        if (availableCells.length === 0) return prev;

        const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
        cellSpawnTimesRef.current[randomCell] = Date.now();

        setTimeout(() => {
          setActiveCellIndices((current) => current.filter((id) => id !== randomCell));
        }, TARGET_LIFESPAN_MS);

        return [...prev, randomCell];
      });
    }, TARGET_SPAWN_INTERVAL_MS);
  };

  const startTappingRound = () => {
    if (!memberName.trim()) {
      Alert.alert('Identity Required', 'Please fill in a student name to track your analytics properly.');
      return;
    }
    
    const currentName = memberName.trim();
    setAttempts((prev) => prev.filter((a) => !(a.memberName === currentName && a.phase === activePhase)));
    resetRoundState();
    setRoundActive(true);

    startMultiTargetGridLoop();

    countdownTimerRef.current = setInterval(() => {
      setTimeLeftMs((prev) => {
        const remaining = prev - 100;
        if (remaining <= 0) {
          clearInterval(countdownTimerRef.current!);
          clearInterval(spawnIntervalRef.current!);
          setRoundActive(false);
          setActiveCellIndices([]);

          const totalHits = currentRoundDeltasRef.current.length;
          if (totalHits > 0) {
            const avgReaction = Math.round(currentRoundDeltasRef.current.reduce((acc, d) => acc + d, 0) / totalHits);
            setAttempts((prev) => [...prev, { memberName: currentName, phase: activePhase, reactionTime: avgReaction, totalHits }]);
            setLastMetricsText(`🎯 Round Finished! Total Hits: ${totalHits} · Avg Speed: ${avgReaction}ms`);
          } else {
            setLastMetricsText("⏰ Time's Up! No targets were tapped.");
          }
          return 0;
        }
        return remaining;
      });
    }, 100);
  };

  // ✅ PERFECTED CALIBRATION: Uses page geometry coordinates minus the container's absolute layout offset position
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setScrollEnabled(false),
      onPanResponderMove: (evt, gestureState) => {
        const adjustedX = gestureState.moveX - arenaLayoutRef.current.x;
        const adjustedY = gestureState.moveY - arenaLayoutRef.current.y;
        fingerPosRef.current = { x: adjustedX, y: adjustedY };
      },
      onPanResponderRelease: () => setScrollEnabled(true),
      onPanResponderTerminate: () => setScrollEnabled(true),
    })
  ).current;

  const runTracingChallengeLoop = () => {
    if (!memberName.trim()) {
      Alert.alert('Identity Required', 'Please assign an active user name before running tracing diagnostics.');
      return;
    }

    resetRoundState();
    setRoundActive(true);
    setScrollEnabled(false);
    traceMetricsRef.current = { totalSamples: 0, matchingSamples: 0, accumulatedDelayMs: 0 };
    
    let elapsed = 0;
    const radiusRadius = (BOARD_SIZE - TARGET_SIZE) / 2 - 10;
    const centerPoint = BOARD_SIZE / 2;

    traceAnimationRef.current = setInterval(() => {
      elapsed += 40;
      
      // Infinite figure-eight infinity path loop curve trajectory formula
      const theta = (elapsed / 1500) * Math.PI;
      const tx = centerPoint + radiusRadius * Math.cos(theta) - TARGET_SIZE / 2;
      const ty = centerPoint + (radiusRadius * Math.sin(2 * theta)) / 2 - TARGET_SIZE / 2;
      
      setTargetPos({ x: tx, y: ty });

      traceMetricsRef.current.totalSamples += 1;
      const deltaX = Math.abs(fingerPosRef.current.x - (tx + TARGET_SIZE / 2));
      const deltaY = Math.abs(fingerPosRef.current.y - (ty + TARGET_SIZE / 2));
      const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

      // Increased threshold radius tolerance margin for easier tracing and better feedback
      if (distance <= 85) {
        traceMetricsRef.current.matchingSamples += 1;
      }
      traceMetricsRef.current.accumulatedDelayMs += Math.round(distance * 1.2);

      // Real-time responsive visual score updates
      const samples = traceMetricsRef.current.totalSamples;
      const currentAcc = Math.round((traceMetricsRef.current.matchingSamples / samples) * 100);
      setLiveAccuracy(currentAcc);

      if (elapsed >= TRACE_DURATION_MS) {
        clearInterval(traceAnimationRef.current!);
        setRoundActive(false);
        setScrollEnabled(true);

        const computedDelay = Math.round(traceMetricsRef.current.accumulatedDelayMs / samples);

        setAttempts((prev) => [
          ...prev.filter((a) => !(a.memberName === memberName.trim() && a.phase === 3)),
          { memberName: memberName.trim(), phase: 3, accuracyPercent: currentAcc, delayMs: computedDelay },
        ]);

        setLastMetricsText(`🎉 Analysis Ready! Target Accuracy: ${currentAcc}% · Delta Lag: ${computedDelay}ms`);
      }
    }, 40);
  };

  const uploadEntireManifestDataset = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Authentication Required', 'Log in to save your cloud lab configurations.');
    if (!hasAllPhasesRecorded(attempts)) {
      return Alert.alert(
        'Complete all phases',
        'Record at least one trial for Phase 1, Phase 2, and Phase 3 before uploading.'
      );
    }
    setIsSyncing(true);
    try {
      const teamInfo = await getTeamData();
      const mappedPayload = attempts.map((a) => ({ phase: a.phase, reactionTime: a.reactionTime ?? a.delayMs ?? null, tooEarly: false })) as any[];
      await uploadReactionResult(user.uid, teamInfo, mappedPayload, null);
      stopChallengeTimer();
      Alert.alert('Sync Complete', 'Your results have been uploaded successfully!');
    } catch {
      Alert.alert('Upload Error', 'Failed to connect to the database module.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleChallengeTimerManualStop = () => {
    Alert.alert(
      'Challenge still in progress',
      'Complete Phases 1, 2, and 3, then upload your records to finish the challenge timer.'
    );
  };

  const allPhasesComplete = hasAllPhasesRecorded(attempts);
  const phasesRecordedCount = new Set(attempts.map((a) => a.phase)).size;
  const timeBarWidthPercent = `${Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_MS) * 100))}%`;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <ReactionScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}>
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
                      backgroundColor: isActiveTab ? primary : primarySoft,
                      borderColor: isActiveTab ? primary : border,
                    },
                  ]}>
                  <Text
                    style={[styles.tabPillText, { color: isActiveTab ? onPrimary : primary }]}
                    numberOfLines={1}>
                    {SCREEN_TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {screenTab === 'instructions' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="yellow">
                {pixelFontLoaded ? <OverviewHeroTitle pixelFamily={pixelFamily} /> : null}
                <PanelMuted style={styles.heroSubtitle}>Health · Neuroscience</PanelMuted>
                <PanelMuted style={styles.heroBody}>
                  Measure reaction speed and hand–eye coordination across three phases — dominant
                  hand, non-dominant hand, then tracing a moving target.
                </PanelMuted>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setScreenTab('activity')}
                  style={[
                    styles.heroCta,
                    {
                      backgroundColor: primary,
                      borderColor: primary,
                      borderBottomColor: primaryDark,
                    },
                  ]}>
                  <Text style={[styles.heroCtaText, { color: onPrimary }]}>▶  Start activity</Text>
                </Pressable>
              </ColorPanel>

              <ColorPanel colour="sky">
                <OverviewConductExperiment />
              </ColorPanel>
            </View>
          )}

          {screenTab === 'activity' && (
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
                  onStop={handleChallengeTimerManualStop}
                />
              </ColorPanel>

              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: primarySoft }]}>
                  <MaterialIcons name="touch-app" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Phase {activePhase} of 3
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: primarySoft }]}>
                  <MaterialIcons name="assignment" size={14} color={primary} />
                  <Text style={[styles.statusPillText, { color: primary }]}>
                    Phases done {phasesRecordedCount}/3
                  </Text>
                </View>
              </View>

              <View style={styles.phaseIndicatorRow}>
                {([1, 2, 3] as ActivityPhase[]).map((p) => {
                  const isSelected = activePhase === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => {
                        setActivePhase(p);
                        resetRoundState();
                      }}
                      style={[
                        styles.phasePill,
                        {
                          backgroundColor: isSelected ? primary : primarySoft,
                          borderColor: isSelected ? primary : border,
                        },
                      ]}>
                      <Text style={[styles.phasePillText, { color: isSelected ? onPrimary : primary }]}>
                        Phase {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <StepPanel step={1} colour={EXPERIMENT_STEP_COLOURS[0]} title="Student & phase">
                <PanelMuted style={styles.stepHint}>
                  Enter the student name, choose a phase above, then run the round in Step 2.
                </PanelMuted>
                <Input
                  label="Student name"
                  placeholder="Enter name"
                  value={memberName}
                  onChangeText={setMemberName}
                  editable={!roundActive}
                />
              </StepPanel>

              <StepPanel step={2} colour={EXPERIMENT_STEP_COLOURS[1]} title="Run round">
                <ReactionRoundArena
                  activePhase={activePhase}
                  roundActive={roundActive}
                  memberName={memberName}
                  timeLeftMs={timeLeftMs}
                  timeBarWidthPercent={timeBarWidthPercent}
                  liveAccuracy={liveAccuracy}
                  activeCellIndices={activeCellIndices}
                  targetPos={targetPos}
                  lastMetricsText={lastMetricsText}
                  panHandlers={panResponder.panHandlers}
                  onArenaLayout={(x, y) => {
                    arenaLayoutRef.current = { x, y };
                  }}
                  onCellTap={handleCellTap}
                  onStartRound={activePhase === 3 ? runTracingChallengeLoop : startTappingRound}
                  onResetRound={resetRoundState}
                  onNextMember={prepNextTeamMemberAttempt}
                />
              </StepPanel>

              <StepPanel step={3} colour={EXPERIMENT_STEP_COLOURS[2]} title="Trial records">
                {attempts.length === 0 ? (
                  <PanelMuted style={styles.emptyHint}>No trials recorded yet.</PanelMuted>
                ) : (
                  <View style={styles.attemptsWrap}>
                    {attempts.map((item, index) => (
                      <AttemptRow
                        key={`${item.memberName}-${item.phase}-${index}`}
                        index={index + 1}
                        title={`${item.memberName} · Phase ${item.phase}`}
                        subtitle={formatTrialSubtitle(item)}
                        isLast={index === attempts.length - 1}
                      />
                    ))}
                  </View>
                )}
                {attempts.length > 0 && !allPhasesComplete && (
                  <PanelMuted style={[styles.uploadHint, { marginTop: Spacing.sm }]}>
                    Record a trial for each phase (1, 2, and 3) before uploading to finish the
                    challenge timer.
                  </PanelMuted>
                )}
                {attempts.length > 0 && (
                  <PrimaryButton
                    style={{ marginTop: Spacing.md }}
                    label={isSyncing ? 'Uploading...' : 'Upload records'}
                    onPress={() => void uploadEntireManifestDataset()}
                    disabled={isSyncing || roundActive || !allPhasesComplete}
                  />
                )}
              </StepPanel>
            </View>
          )}

          {screenTab === 'discussion' && (
            <View style={styles.tabContent}>
              <ColorPanel colour="lavender">
                <PanelTitle>Neuroscience insights</PanelTitle>
                <PanelMuted style={styles.body}>
                  Grid tapping measures fast reflex pathways from eye to hand. Tracing adds
                  continuous movement — testing how well the brain keeps the hand aligned with a
                  moving target.
                </PanelMuted>
              </ColorPanel>
            </View>
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
    flexGrow: 1,
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
    flex: 1,
    minHeight: 40,
    paddingHorizontal: Spacing.xs,
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
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
    aspectRatio: REACTION_PHASE3_ASPECT,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  instructionNum: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNumText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  instructionText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
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
  phaseGuideTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
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
  emptyHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  uploadHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  attemptsWrap: {
    gap: Spacing.sm,
  },
  phaseIndicatorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  phasePill: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phasePillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  gridTestingMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: Radius.xl,
    alignSelf: 'center',
    justifyContent: 'space-evenly',
    alignContent: 'space-evenly',
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  gridCellElement: {
    borderWidth: 1,
  },
  metricsSummaryOutputText: {
    textAlign: 'center',
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
  },
  tracingTargetNode: {
    position: 'absolute',
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: 99,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tracingPlaceholderText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    top: '46%',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    opacity: 0.5,
  },
  timerTrackField: {
    height: 24,
    width: '100%',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    justifyContent: 'center',
    position: 'relative',
  },
  timerProgressBarFill: {
    height: '100%',
    left: 0,
    position: 'absolute',
    opacity: 0.25,
  },
  timerPercentageText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.sm,
    zIndex: 2,
  },
  actionControlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionHalf: {
    flex: 1,
  },
  nextMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    height: 40,
    marginTop: Spacing.md,
  },
  nextMemberButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  liveMetricsHUD: {
    borderWidth: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  hudLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  hudValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  body: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
});