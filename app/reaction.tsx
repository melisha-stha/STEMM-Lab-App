import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import type { ReactionAttempt } from '@/hooks/firestore';
import { uploadReactionResult } from '@/hooks/firestore';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

const ACTIVITY_REACTION = 'reaction';
const TAPS_PER_ROUND = 10;
const BUTTON_COUNT = 8;
const BOARD_PADDING = 60;
const BOARD_BOTTOM_RESERVE = 200;
const BUTTON_DIAMETER = 56;
const BUTTON_RADIUS = BUTTON_DIAMETER / 2;
const TRACING_DURATION_MS = 10000;
const TRACING_RADIUS = 80;
const TRACING_ROTATION_MS = 4000;
const TRACING_ACCURACY_DISTANCE = 80;

const REACTION_FAST_MS = 300;
const REACTION_SLOW_MS = 500;

const COLOR_REACTION_FAST = '#2E7D32';
const COLOR_REACTION_MID = '#F57F17';
const COLOR_REACTION_SLOW = '#C62828';
const COLOR_BUTTON_INACTIVE = '#9E9E9E';
const COLOR_BUTTON_ACTIVE = '#4CAF50';
const COLOR_TARGET = '#FF5722';

type ScreenTab = 'instructions' | 'activity' | 'discussion';
type ActivityPhase = 1 | 2 | 3;
type ButtonPosition = { x: number; y: number };

const SCREEN_TABS: ScreenTab[] = ['instructions', 'activity', 'discussion'];
const SCREEN_TAB_LABELS: Record<ScreenTab, string> = {
  instructions: 'Instructions',
  activity: 'Activity',
  discussion: 'Discussion',
};

const PHASE_LABELS: Record<ActivityPhase, string> = {
  1: 'Phase 1 — Tap Reaction',
  2: 'Phase 2 — Swap Hands',
  3: 'Phase 3 — Tracing Challenge',
};

const getReactionColor = (ms: number): string => {
  if (ms < REACTION_FAST_MS) return COLOR_REACTION_FAST;
  if (ms <= REACTION_SLOW_MS) return COLOR_REACTION_MID;
  return COLOR_REACTION_SLOW;
};

const generateButtonPositions = (
  screenWidth: number,
  screenHeight: number,
  count: number
): ButtonPosition[] => {
  const positions: ButtonPosition[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: BOARD_PADDING + Math.random() * (screenWidth - BOARD_PADDING * 2),
      y: BOARD_PADDING + Math.random() * (screenHeight - BOARD_PADDING * 2 - BOARD_BOTTOM_RESERVE),
    });
  }
  return positions;
};

const calculateTracingAccuracy = (
  fingerX: number,
  fingerY: number,
  targetX: number,
  targetY: number
): number => {
  const distance = Math.sqrt(
    Math.pow(fingerX - targetX, 2) + Math.pow(fingerY - targetY, 2)
  );
  return Math.max(0, Math.round(100 - (distance / TRACING_ACCURACY_DISTANCE) * 100));
};

const averageReactionTime = (items: ReactionAttempt[]): number | null => {
  const times = items
    .filter((a) => !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  if (!times.length) return null;
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
};

const bestReactionTimeForPhase = (items: ReactionAttempt[]): number | null => {
  const times = items
    .filter((a) => !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  return times.length ? Math.min(...times) : null;
};

const calculateAverageReactionTime = (items: ReactionAttempt[]): number => {
  const times = items
    .filter((a) => (a.phase === 1 || a.phase === 2) && !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  if (!times.length) return 0;
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
};

const bestReactionTime = (items: ReactionAttempt[]): number | null => {
  const times = items
    .filter((a) => (a.phase === 1 || a.phase === 2) && !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  return times.length ? Math.min(...times) : null;
};

const pickNextButtonIndex = (previousIndex: number | null, count: number): number => {
  if (count <= 1) return 0;
  if (previousIndex == null) return Math.floor(Math.random() * count);
  let next = Math.floor(Math.random() * count);
  while (next === previousIndex) {
    next = Math.floor(Math.random() * count);
  }
  return next;
};

export default function ReactionScreen() {
  const router = useRouter();
  const boardLayout = useRef({ width: 0, height: 0 });
  const boardRef = useRef<View>(null);
  const buttonPositionsRef = useRef<ButtonPosition[] | null>(null);
  const [, setBoardLayoutReady] = useState(false);

  const [screenTab, setScreenTab] = useState<ScreenTab>('instructions');
  const [activePhase, setActivePhase] = useState<ActivityPhase>(1);
  const [attempts, setAttempts] = useState<ReactionAttempt[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const [roundActive, setRoundActive] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [activeButtonIndex, setActiveButtonIndex] = useState<number | null>(null);
  const [tapInRound, setTapInRound] = useState(0);
  const [lastTapMs, setLastTapMs] = useState<number | null>(null);

  const [tracing, setTracing] = useState(false);
  const [liveAccuracy, setLiveAccuracy] = useState(0);
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });

  const reactionStart = useRef(0);
  const tracingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const tracingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accuracyReadings = useRef<number[]>([]);
  const animationStart = useRef(0);
  const currentTargetX = useRef(0);
  const currentTargetY = useRef(0);
  const boardScreenOffset = useRef({ x: 0, y: 0 });
  const tracingActiveRef = useRef(false);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const phaseAttempts = useMemo(
    () => attempts.filter((a) => a.phase === activePhase),
    [attempts, activePhase]
  );

  const phase1Attempts = useMemo(() => attempts.filter((a) => a.phase === 1), [attempts]);
  const phase2Attempts = useMemo(() => attempts.filter((a) => a.phase === 2), [attempts]);
  const phase3Attempts = useMemo(() => attempts.filter((a) => a.phase === 3), [attempts]);

  const avgPhase1 = useMemo(() => averageReactionTime(phase1Attempts), [phase1Attempts]);
  const avgPhase2 = useMemo(() => averageReactionTime(phase2Attempts), [phase2Attempts]);
  const avgPhase3 = useMemo(() => {
    const scores = phase3Attempts.map((a) => a.accuracy).filter((v): v is number => v != null);
    if (!scores.length) return null;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [phase3Attempts]);

  const overallBest = useMemo(() => bestReactionTime(attempts), [attempts]);
  const allPhasesComplete =
    phase1Attempts.length >= TAPS_PER_ROUND &&
    phase2Attempts.length >= TAPS_PER_ROUND &&
    phase3Attempts.length >= 1;

  useEffect(() => {
    tracingActiveRef.current = tracing;
  }, [tracing]);

  useEffect(() => {
    return () => {
      stopTracingLoop();
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => tracingActiveRef.current,
      onMoveShouldSetPanResponder: () => tracingActiveRef.current,
      onPanResponderGrant: (_, gestureState) => {
        if (!tracingActiveRef.current) return;
        const fingerX = gestureState.x0 - boardScreenOffset.current.x;
        const fingerY = gestureState.y0 - boardScreenOffset.current.y;
        const accuracy = calculateTracingAccuracy(
          fingerX,
          fingerY,
          currentTargetX.current,
          currentTargetY.current
        );
        accuracyReadings.current.push(accuracy);
        setLiveAccuracy(accuracy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!tracingActiveRef.current) return;
        const fingerX = gestureState.moveX - boardScreenOffset.current.x;
        const fingerY = gestureState.moveY - boardScreenOffset.current.y;
        const accuracy = calculateTracingAccuracy(
          fingerX,
          fingerY,
          currentTargetX.current,
          currentTargetY.current
        );
        accuracyReadings.current.push(accuracy);
        setLiveAccuracy(accuracy);
      },
    })
  ).current;

  const stopTracingLoop = (): void => {
    if (tracingInterval.current) {
      clearInterval(tracingInterval.current);
      tracingInterval.current = null;
    }
    if (tracingStopTimer.current) {
      clearTimeout(tracingStopTimer.current);
      tracingStopTimer.current = null;
    }
  };

  const measureBoardOffset = (): void => {
    boardRef.current?.measureInWindow((x, y) => {
      boardScreenOffset.current = { x, y };
    });
  };

  const recordAttempt = (entry: ReactionAttempt): void => {
    setAttempts((prev) => [...prev, entry]);
  };

  const lightNextButton = (previousIndex: number | null): void => {
    const nextIndex = pickNextButtonIndex(previousIndex, BUTTON_COUNT);
    setActiveButtonIndex(nextIndex);
    reactionStart.current = Date.now();
  };

  const startRound = (): void => {
    if (phaseAttempts.length >= TAPS_PER_ROUND || roundActive) return;
    setRoundComplete(false);
    setRoundActive(true);
    setTapInRound(0);
    setLastTapMs(null);
    lightNextButton(null);
  };

  const handleButtonTap = (index: number): void => {
    if (!roundActive || activeButtonIndex !== index) return;

    const reactionTime = Date.now() - reactionStart.current;
    setLastTapMs(reactionTime);
    recordAttempt({ phase: activePhase, reactionTime, tooEarly: false });

    const completedTaps = tapInRound + 1;
    setTapInRound(completedTaps);

    if (completedTaps >= TAPS_PER_ROUND) {
      setRoundActive(false);
      setActiveButtonIndex(null);
      setRoundComplete(true);
      return;
    }

    lightNextButton(index);
  };

  const startTracingChallenge = (): void => {
    if (phaseAttempts.length >= 1) return;
    const { width, height } = boardLayout.current;
    if (!width || !height) return;

    accuracyReadings.current = [];
    setLiveAccuracy(0);
    setTracing(true);
    tracingActiveRef.current = true;
    animationStart.current = Date.now();
    measureBoardOffset();

    const cx = width / 2;
    const cy = height / 2;
    const initialTarget = { x: cx + TRACING_RADIUS, y: cy };
    currentTargetX.current = initialTarget.x;
    currentTargetY.current = initialTarget.y;
    setTargetPos(initialTarget);

    tracingInterval.current = setInterval(() => {
      const elapsed = (Date.now() - animationStart.current) % TRACING_ROTATION_MS;
      const angle = (elapsed / TRACING_ROTATION_MS) * 2 * Math.PI;
      const nextTarget = {
        x: cx + TRACING_RADIUS * Math.cos(angle),
        y: cy + TRACING_RADIUS * Math.sin(angle),
      };
      currentTargetX.current = nextTarget.x;
      currentTargetY.current = nextTarget.y;
      setTargetPos(nextTarget);
    }, 16);

    tracingStopTimer.current = setTimeout(() => {
      stopTracingLoop();
      setTracing(false);
      tracingActiveRef.current = false;
      const samples = accuracyReadings.current;
      const avgAccuracy = samples.length
        ? Math.round(samples.reduce((sum, v) => sum + v, 0) / samples.length)
        : 0;
      recordAttempt({ phase: 3, accuracy: avgAccuracy });
      setLiveAccuracy(avgAccuracy);
    }, TRACING_DURATION_MS);
  };

  const resetRoundState = (): void => {
    setRoundActive(false);
    setRoundComplete(false);
    setActiveButtonIndex(null);
    setTapInRound(0);
    setLastTapMs(null);
  };

  const saveResults = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please log in to save your results.');
      return;
    }
    if (attempts.length === 0) {
      Alert.alert('No attempts recorded', 'Please complete at least one attempt before saving.');
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
      const avgReactionTime = calculateAverageReactionTime(attempts);

      await Promise.all([
        uploadReactionResult(user.uid, teamData, attempts, locationData),
        Promise.resolve(
          insertTrial(
            teamData?.name || 'unknown',
            ACTIVITY_REACTION,
            avgReactionTime,
            '',
            locationData?.latitude ?? null,
            locationData?.longitude ?? null
          )
        ),
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'STEMM Lab Sync Complete',
          body: `${teamData?.name || 'Your team'} — Reaction result saved`,
          data: { screen: 'reaction-results' },
        },
        trigger: null,
      });

      router.push({
        pathname: '/reaction-results' as '/earthquake-results',
        params: { attemptsJson: JSON.stringify(attempts) },
      });
    } catch (error) {
      console.error('Reaction save error:', error);
      Alert.alert('Sync Error', "We couldn't save your data. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const renderInstructionsTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Overview</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Students measure reaction time, coordination, and improvement through repeated digital and
        physical challenges.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Equipment</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>• Mobile phone with STEMM Lab app</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Clear working space</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Instructions</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.phaseHeading, { color: text }]}>Phase 1 - Tap Reaction</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Tap the lit button as fast as you can</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Complete 10 taps per round</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Rotate through each team member</Text>

        <Text style={[styles.phaseHeading, { color: text }]}>Phase 2 - Swap Hands</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Repeat using the non-dominant hand</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Compare results</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Rotate through each team member</Text>

        <Text style={[styles.phaseHeading, { color: text }]}>Phase 3 - Tracing Challenge</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Trace a moving shape on the screen</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Review accuracy and delay</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Rotate through each team member</Text>
      </View>
    </SectionCard>
  );

  const renderTapPhase = (): React.ReactElement => {
    const phaseAvg = averageReactionTime(phaseAttempts);
    const phaseBest = bestReactionTimeForPhase(phaseAttempts);
    const phaseDone =
      phaseAttempts.length >= TAPS_PER_ROUND ||
      (roundComplete && tapInRound >= TAPS_PER_ROUND);
    const resultColor = lastTapMs != null ? getReactionColor(lastTapMs) : mutedText;
    const liveTapNumber = roundActive ? tapInRound + 1 : Math.min(tapInRound, TAPS_PER_ROUND);

    return (
      <View style={styles.activityBlock}>
        {activePhase === 2 ? (
          <Text style={[styles.phaseBanner, { color: primary, backgroundColor: card, borderColor: border }]}>
            Phase 2 — Use your non-dominant hand
          </Text>
        ) : null}

        <View
          style={[styles.reactionBoard, { borderColor: border }]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            boardLayout.current = { width, height };
            if (!buttonPositionsRef.current && width > 0 && height > 0) {
              buttonPositionsRef.current = generateButtonPositions(width, height, BUTTON_COUNT);
              setBoardLayoutReady(true);
            }
          }}>
          {(buttonPositionsRef.current ?? []).map((pos, index) => {
            const isActive = roundActive && activeButtonIndex === index;
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.85}
                disabled={!roundActive || activeButtonIndex !== index}
                onPress={() => handleButtonTap(index)}
                style={[
                  styles.scatterButton,
                  {
                    left: pos.x - BUTTON_RADIUS,
                    top: pos.y - BUTTON_RADIUS,
                    backgroundColor: isActive ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON_INACTIVE,
                  },
                ]}
              />
            );
          })}
        </View>

        {roundActive ? (
          <Text style={[styles.statusText, { color: text }]}>
            Tap {liveTapNumber} of {TAPS_PER_ROUND}
          </Text>
        ) : null}

        {lastTapMs != null && roundActive ? (
          <Text style={[styles.resultText, { color: resultColor }]}>{lastTapMs} ms</Text>
        ) : null}

        {!phaseDone && !roundComplete ? (
          <View style={styles.controls}>
            <PrimaryButton
              label="Start Round"
              onPress={startRound}
              disabled={roundActive || isSyncing}
            />
          </View>
        ) : null}

        {(roundComplete || phaseDone) && phaseAvg != null ? (
          <View style={styles.roundSummary}>
            <Text style={[styles.resultText, { color: text }]}>Round complete</Text>
            <Text style={[styles.helper, { color: mutedText }]}>Average: {phaseAvg} ms</Text>
            <Text style={[styles.helper, { color: mutedText }]}>
              Best tap: {phaseBest != null ? `${phaseBest} ms` : '—'}
            </Text>
          </View>
        ) : null}

        {phaseDone && activePhase < 3 ? (
          <PrimaryButton
            label="Next Phase"
            variant="secondary"
            onPress={() => {
              setActivePhase((phase) => (phase + 1) as ActivityPhase);
              resetRoundState();
            }}
          />
        ) : null}
      </View>
    );
  };

  const renderTracingPhase = (): React.ReactElement => (
    <View style={styles.activityBlock}>
      <Text style={[styles.phaseHint, { color: mutedText }]}>
        Keep your finger on the moving circle
      </Text>
      <View
        ref={boardRef}
        style={[styles.tracingBoard, { borderColor: border, backgroundColor: card }]}
        onLayout={(e) => {
          boardLayout.current = {
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          };
          measureBoardOffset();
        }}>
        <View
          style={[
            styles.targetDot,
            {
              left: targetPos.x - 14,
              top: targetPos.y - 14,
              backgroundColor: COLOR_TARGET,
            },
          ]}
        />
        {tracing ? (
          <View
            style={styles.tracingOverlay}
            {...panResponder.panHandlers}
          />
        ) : null}
      </View>

      <Text style={[styles.resultText, { color: primary }]}>Accuracy: {liveAccuracy}%</Text>

      <PrimaryButton
        label={tracing ? 'Tracing…' : 'Start Tracing'}
        onPress={startTracingChallenge}
        disabled={tracing || phaseAttempts.length >= 1 || isSyncing}
      />

      {phaseAttempts.length >= 1 && activePhase === 3 ? (
        <Text style={[styles.helper, { color: mutedText }]}>
          Phase 3 complete · Average accuracy: {avgPhase3 ?? '—'}%
        </Text>
      ) : null}
    </View>
  );

  const renderSummary = (): React.ReactElement | null => {
    if (!allPhasesComplete) return null;
    const handDiff =
      avgPhase1 != null && avgPhase2 != null ? avgPhase2 - avgPhase1 : null;

    return (
      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Results Summary</Text>
        <View style={[styles.summaryList, { borderTopColor: border }]}>
          <Text style={[styles.summaryRow, { color: mutedText }]}>
            Phase 1 average: {avgPhase1 != null ? `${avgPhase1} ms` : '—'}
          </Text>
          <Text style={[styles.summaryRow, { color: mutedText }]}>
            Phase 2 average: {avgPhase2 != null ? `${avgPhase2} ms` : '—'}
          </Text>
          <Text style={[styles.summaryRow, { color: mutedText }]}>
            Phase 2 vs Phase 1:{' '}
            {handDiff != null ? `${handDiff > 0 ? '+' : ''}${handDiff} ms` : '—'}
          </Text>
          <Text style={[styles.summaryRow, { color: mutedText }]}>
            Phase 3 tracing accuracy: {avgPhase3 != null ? `${avgPhase3}%` : '—'}
          </Text>
          <Text style={[styles.summaryRow, { color: text, fontWeight: '700' }]}>
            Best reaction time: {overallBest != null ? `${overallBest} ms` : '—'}
          </Text>
        </View>
        <PrimaryButton
          label={isSyncing ? 'Saving…' : 'Save Results'}
          onPress={() => void saveResults()}
          disabled={isSyncing}
          style={{ marginTop: Spacing.sm }}
        />
      </SectionCard>
    );
  };

  const renderActivityTab = (): React.ReactElement => (
    <View style={styles.activityWrap}>
      <View style={styles.phaseIndicatorRow}>
        {([1, 2, 3] as ActivityPhase[]).map((phase) => {
          const isActive = activePhase === phase;
          return (
            <Pressable
              key={phase}
              onPress={() => {
                if (phase <= activePhase || phaseAttempts.length > 0) {
                  setActivePhase(phase);
                  resetRoundState();
                }
              }}
              style={[
                styles.phasePill,
                {
                  backgroundColor: isActive ? primary : card,
                  borderColor: isActive ? primary : border,
                },
              ]}>
              <Text style={[styles.phasePillText, { color: isActive ? onPrimary : text }]}>
                {phase}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.phaseTitle, { color: text }]}>{PHASE_LABELS[activePhase]}</Text>

      {activePhase === 3 ? renderTracingPhase() : renderTapPhase()}
      {renderSummary()}
    </View>
  );

  const renderDiscussionTab = (): React.ReactElement => (
    <SectionCard>
      <Text style={[styles.sectionTitle, { color: text }]}>Reaction Time and the Brain</Text>
      <Text style={[styles.body, { color: mutedText }]}>
        Reaction time measures how quickly the brain processes information and sends signals to
        muscles. Practice can improve speed and coordination. Comparing hands shows how dominance
        affects performance.
      </Text>

      <Text style={[styles.sectionTitle, { color: text, marginTop: Spacing.md }]}>Curriculum links</Text>
      <View style={[styles.bullets, { borderTopColor: border }]}>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Science Inquiry: ACSIS130 — Collecting and analysing data
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Mathematics: ACMSP147 — Averages and variation
        </Text>
        <Text style={[styles.bullet, { color: mutedText }]}>
          Health: ACPPS057 — Understanding physical performance
        </Text>
      </View>
    </SectionCard>
  );

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Reaction Board Challenge</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Measure reaction time, coordination, and tracing accuracy.
        </Text>
      </View>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isActive = screenTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setScreenTab(tab)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActive ? primary : card,
                  borderColor: isActive ? primary : border,
                },
              ]}>
              <Text style={[styles.tabPillText, { color: isActive ? onPrimary : text }]}>
                {SCREEN_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'instructions' ? renderInstructionsTab() : null}
      {screenTab === 'activity' ? renderActivityTab() : null}
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

const boardMinHeight = Math.min(Dimensions.get('window').height * 0.35, 320);

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
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
  body: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  phaseHeading: { ...Typography.section, fontSize: 14, marginTop: Spacing.sm },
  activityWrap: { gap: Spacing.md },
  phaseIndicatorRow: { flexDirection: 'row', gap: Spacing.sm },
  phasePill: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phasePillText: { ...Typography.small, fontWeight: '700' },
  phaseTitle: { ...Typography.section },
  activityBlock: { gap: Spacing.sm },
  phaseHint: { ...Typography.body, fontWeight: '600' },
  phaseBanner: {
    ...Typography.body,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  reactionBoard: {
    position: 'relative',
    minHeight: boardMinHeight,
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  scatterButton: {
    position: 'absolute',
    width: BUTTON_DIAMETER,
    height: BUTTON_DIAMETER,
    borderRadius: BUTTON_RADIUS,
  },
  tracingBoard: {
    position: 'relative',
    minHeight: boardMinHeight,
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  tracingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  targetDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  statusText: { ...Typography.body, textAlign: 'center', fontWeight: '600' },
  resultText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  controls: { gap: Spacing.sm },
  roundSummary: { gap: Spacing.xs, alignItems: 'center' },
  helper: { ...Typography.small, textAlign: 'center' },
  summaryList: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  summaryRow: { ...Typography.body, fontSize: 13 },
});
