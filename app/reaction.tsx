import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { insertTrial } from '@/hooks/database';
import type { ReactionAttempt } from '@/hooks/firestore';
import { uploadReactionResult } from '@/hooks/firestore';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACTIVITY_REACTION = 'reaction';
const TAPS_PER_ROUND = 10;
const BUTTON_COUNT = 8;
const MIN_DISTANCE = 90;
const BUTTON_POSITION_MAX_ATTEMPTS = 200;
const SCREEN_HORIZONTAL_PADDING = 80;
const SCREEN_TOP_PADDING = 120;
const SCREEN_BOTTOM_PADDING = 250;
const USABLE_PLAY_HEIGHT = SCREEN_HEIGHT - SCREEN_TOP_PADDING - SCREEN_BOTTOM_PADDING;
const BUTTON_DIAMETER = 56;
const BUTTON_RADIUS = BUTTON_DIAMETER / 2;
const REACTION_FAST_MS = 300;
const REACTION_SLOW_MS = 500;

const COLOR_REACTION_FAST = '#2E7D32';
const COLOR_REACTION_MID = '#F57F17';
const COLOR_REACTION_SLOW = '#C62828';
const COLOR_BUTTON_INACTIVE = '#3A3A3A';

const BUTTON_COLOURS = [
  '#E53935',
  '#8E24AA',
  '#1E88E5',
  '#00897B',
  '#F4511E',
  '#039BE5',
  '#7CB342',
  '#FFB300',
] as const;

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
  3: 'Phase 3 — Predict & Tap',
};

const getPhaseBanner = (phase: ActivityPhase): string | null => {
  if (phase === 1) return null;
  if (phase === 2) return 'Phase 2 — Use your non-dominant hand';
  return 'Phase 3 — Try to predict where the next button will appear and move early';
};

const getReactionColor = (ms: number): string => {
  if (ms < REACTION_FAST_MS) return COLOR_REACTION_FAST;
  if (ms <= REACTION_SLOW_MS) return COLOR_REACTION_MID;
  return COLOR_REACTION_SLOW;
};

const generateButtonPositions = (count: number): ButtonPosition[] => {
  const positions: ButtonPosition[] = [];
  let attempts = 0;

  while (positions.length < count && attempts < BUTTON_POSITION_MAX_ATTEMPTS) {
    attempts++;
    const candidate = {
      x: SCREEN_HORIZONTAL_PADDING + Math.random() * (SCREEN_WIDTH - SCREEN_HORIZONTAL_PADDING * 2),
      y: Math.random() * (USABLE_PLAY_HEIGHT - BUTTON_DIAMETER),
    };

    const tooClose = positions.some(
      (p) =>
        Math.sqrt((p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2) < MIN_DISTANCE
    );

    if (!tooClose) positions.push(candidate);
  }

  return positions;
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
    .filter((a) => !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  if (!times.length) return 0;
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
};

const bestReactionTime = (items: ReactionAttempt[]): number | null => {
  const times = items
    .filter((a) => !a.tooEarly && a.reactionTime != null)
    .map((a) => a.reactionTime as number);
  return times.length ? Math.min(...times) : null;
};

const getNextButtonIndex = (currentIndex: number, totalButtons: number): number => {
  let next: number;
  do {
    next = Math.floor(Math.random() * totalButtons);
  } while (next === currentIndex);
  return next;
};

export default function ReactionScreen() {
  const router = useRouter();
  const buttonPositionsRef = useRef<ButtonPosition[]>(generateButtonPositions(BUTTON_COUNT));

  const [screenTab, setScreenTab] = useState<ScreenTab>('instructions');
  const [activePhase, setActivePhase] = useState<ActivityPhase>(1);
  const [attempts, setAttempts] = useState<ReactionAttempt[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const [roundActive, setRoundActive] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [activeButtonIndex, setActiveButtonIndex] = useState<number | null>(null);
  const [tapInRound, setTapInRound] = useState(0);
  const [lastTapMs, setLastTapMs] = useState<number | null>(null);

  const reactionStart = useRef(0);

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
  const avgPhase3 = useMemo(() => averageReactionTime(phase3Attempts), [phase3Attempts]);

  const overallBest = useMemo(() => bestReactionTime(attempts), [attempts]);
  const allPhasesComplete =
    phase1Attempts.length >= TAPS_PER_ROUND &&
    phase2Attempts.length >= TAPS_PER_ROUND &&
    phase3Attempts.length >= TAPS_PER_ROUND;

  const recordAttempt = (entry: ReactionAttempt): void => {
    setAttempts((prev) => [...prev, entry]);
  };

  const startRound = (): void => {
    if (phaseAttempts.length >= TAPS_PER_ROUND || roundActive) return;
    setRoundComplete(false);
    setRoundActive(true);
    setTapInRound(0);
    setLastTapMs(null);
    const firstIndex = Math.floor(Math.random() * BUTTON_COUNT);
    setActiveButtonIndex(firstIndex);
    reactionStart.current = Date.now();
  };

  const handleButtonTap = (index: number): void => {
    if (!roundActive || activeButtonIndex !== index) return;

    const reactionTime = Date.now() - reactionStart.current;
    setLastTapMs(reactionTime);
    recordAttempt({ phase: activePhase, reactionTime, tooEarly: false });

    setTapInRound((prev) => {
      const completedTaps = prev + 1;
      if (completedTaps >= TAPS_PER_ROUND) {
        setRoundActive(false);
        setActiveButtonIndex(null);
        setRoundComplete(true);
      } else {
        const nextIndex = getNextButtonIndex(index, BUTTON_COUNT);
        setActiveButtonIndex(nextIndex);
        reactionStart.current = Date.now();
      }
      return completedTaps;
    });
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

        <Text style={[styles.phaseHeading, { color: text }]}>Phase 3 - Predict & Tap</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Predict where the next button will appear</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Move your hand early and tap as fast as you can</Text>
        <Text style={[styles.bullet, { color: mutedText }]}>• Complete 10 taps per round</Text>
      </View>
    </SectionCard>
  );

  const renderGamePhase = (): React.ReactElement => {
    const phaseAvg = averageReactionTime(phaseAttempts);
    const phaseBest = bestReactionTimeForPhase(phaseAttempts);
    const phaseDone =
      phaseAttempts.length >= TAPS_PER_ROUND ||
      (roundComplete && tapInRound >= TAPS_PER_ROUND);
    const resultColor = lastTapMs != null ? getReactionColor(lastTapMs) : mutedText;
    const liveTapNumber = roundActive ? tapInRound + 1 : Math.min(tapInRound, TAPS_PER_ROUND);
    const phaseBanner = getPhaseBanner(activePhase);

    return (
      <View style={styles.activityBlock}>
        {phaseBanner ? (
          <Text style={[styles.phaseBanner, { color: primary, backgroundColor: card, borderColor: border }]}>
            {phaseBanner}
          </Text>
        ) : null}

        <View
          style={[
            styles.reactionBoard,
            { borderColor: border, minHeight: USABLE_PLAY_HEIGHT, height: USABLE_PLAY_HEIGHT },
          ]}>
          {buttonPositionsRef.current.map((pos, index) => {
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
                    backgroundColor: isActive ? BUTTON_COLOURS[index] : COLOR_BUTTON_INACTIVE,
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
            Phase 3 average: {avgPhase3 != null ? `${avgPhase3} ms` : '—'}
          </Text>
          <Text style={[styles.summaryRow, { color: mutedText }]}>
            Dominant vs non-dominant:{' '}
            {handDiff != null ? `${handDiff > 0 ? '+' : ''}${handDiff} ms` : '—'}
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

      {renderGamePhase()}
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
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Reaction Board Challenge</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Measure reaction time and coordination across three challenge phases.
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
