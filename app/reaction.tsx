import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { uploadReactionResult } from '@/hooks/firestore';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../hooks/firebaseConfig';
import { getTeamData } from '../hooks/storage';

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
  1: 'Phase 1 — Tap Reaction Grid (Dominant)',
  2: 'Phase 2 — Swap Hands (Non-Dominant)',
  3: 'Phase 3 — Neuromuscular Tracing',
};

export default function ReactionScreen() {
  const router = useRouter();

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
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary' as any) ?? '#FFFFFF';

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
        const availableCells = Array.from({ length: 9 }).map((_, i) => i).filter((i) => !prev.includes(i));
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
    setIsSyncing(true);
    try {
      const teamInfo = await getTeamData();
      const mappedPayload = attempts.map((a) => ({ phase: a.phase, reactionTime: a.reactionTime ?? a.delayMs ?? null, tooEarly: false })) as any[];
      await uploadReactionResult(user.uid, teamInfo, mappedPayload, null);
      Alert.alert('Sync Complete', 'Your results have been uploaded successfully!');
    } catch {
      Alert.alert('Upload Error', 'Failed to connect to the database module.');
    } finally {
      setIsSyncing(false);
    }
  };

  const timeBarWidthPercent = `${Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_MS) * 100))}%`;

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Reaction Board Challenge</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Neuroscience + Mathematics</Text>
      </View>

      <View style={styles.tabRow}>
        {SCREEN_TABS.map((tab) => {
          const isActiveTab = screenTab === tab;
          return (
            <Pressable key={tab} onPress={() => setScreenTab(tab)} style={[styles.tabPill, { backgroundColor: isActiveTab ? primary : card, borderColor: isActiveTab ? primary : border }]}>
              <Text style={[styles.tabPillText, { color: isActiveTab ? onPrimary : text }]}>{SCREEN_TAB_LABELS[tab]}</Text>
            </Pressable>
          );
        })}
      </View>

      {screenTab === 'instructions' && (
        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Overview</Text>
          <Text style={[styles.body, { color: mutedText, lineHeight: 20 }]}>
            Measure cognitive processing speeds and motor system responses using visual matrices and trace tracking fields.
          </Text>
          <View style={[styles.bullets, { borderTopColor: border, marginTop: Spacing.md }]}>
            <Text style={[styles.phaseHeading, { color: text }]}>Phase 1 & 2: Motor Reflex Grid</Text>
            <Text style={[styles.bullet, { color: mutedText }]}>• Tap circles as they ignite. Clear as many as you can before the 60-second clock expires.</Text>
            <Text style={[styles.phaseHeading, { color: text }]}>Phase 3: Infinity Path Tracing</Text>
            <Text style={[styles.bullet, { color: mutedText }]}>• Press start and lock your finger onto the moving beacon to map coordination accuracy paths.</Text>
          </View>
        </SectionCard>
      )}

      {screenTab === 'activity' && (
        <View style={styles.activityWrap}>
          <View style={styles.phaseIndicatorRow}>
            {([1, 2, 3] as ActivityPhase[]).map((p) => {
              const isSelected = activePhase === p;
              return (
                <Pressable key={p} onPress={() => { setActivePhase(p); resetRoundState(); }} style={[styles.phasePill, { backgroundColor: isSelected ? primary : card, borderColor: isSelected ? primary : border }]}>
                  <Text style={[styles.phasePillText, { color: isSelected ? onPrimary : text }]}>Phase {p}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.instrumentBox, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.inputLabel, { color: text }]}>Participant Identity Name</Text>
            <TextInput
              style={[styles.inputBoxField, { borderColor: border, color: text, backgroundColor: background }]}
              placeholder="Input student name..."
              placeholderTextColor={mutedText}
              value={memberName}
              onChangeText={setMemberName}
              editable={!roundActive}
            />

            {(activePhase === 1 || activePhase === 2) && roundActive && (
              <View style={styles.timerTrackField}>
                <View style={[styles.timerProgressBarFill, { width: timeBarWidthPercent as any, backgroundColor: primary }]} />
                <Text style={styles.timerPercentageText}>Time Remaining: {Math.ceil(timeLeftMs / 1000)}s</Text>
              </View>
            )}

            {activePhase === 3 && roundActive && (
              <View style={[styles.liveMetricsHUD, { backgroundColor: background, borderColor: border }]}>
                <Text style={[styles.hudLabel, { color: mutedText }]}>LIVE ACCURACY TRACKER</Text>
                <Text style={[styles.hudValue, { color: primary }]}>{liveAccuracy !== null ? `${liveAccuracy}%` : '0%'}</Text>
              </View>
            )}

            {(activePhase === 1 || activePhase === 2) && (
              <View style={[styles.gridTestingMatrix, { width: BOARD_SIZE, height: BOARD_SIZE, borderColor: border }]}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const isTarget = activeCellIndices.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      disabled={!roundActive || !isTarget}
                      onPress={() => handleCellTap(i)}
                      style={[
                        styles.gridCellElement,
                        {
                          width: GRID_CELL_SIZE,
                          height: GRID_CELL_SIZE,
                          backgroundColor: isTarget ? primary : 'rgba(0,0,0,0.03)',
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
                {...panResponder.panHandlers}
                onLayout={(e) => {
                  // Captures the absolute position of the box relative to the native layout tree
                  e.target.measure((x, y, width, height, pageX, pageY) => {
                    arenaLayoutRef.current = { x: pageX, y: pageY };
                  });
                }}
                style={[styles.gridTestingMatrix, { width: BOARD_SIZE, height: BOARD_SIZE, borderColor: border, backgroundColor: background }]}
              >
                <View style={[styles.tracingTargetNode, { left: targetPos.x, top: targetPos.y, backgroundColor: primary, shadowColor: primary }]} />
                {!roundActive && (
                  <Text style={[styles.tracingPlaceholderText, { color: mutedText }]}>Hold & Drag Finger Here</Text>
                )}
              </View>
            )}

            {lastMetricsText ? <Text style={[styles.metricsSummaryOutputText, { color: text }]}>{lastMetricsText}</Text> : null}

            <View style={styles.actionControlRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label={roundActive ? 'Running...' : 'Start Round'} onPress={activePhase === 3 ? runTracingChallengeLoop : startTappingRound} disabled={roundActive} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Reset" variant="secondary" onPress={resetRoundState} />
              </View>
            </View>

            {!roundActive && (
              <TouchableOpacity style={[styles.nextMemberButton, { borderColor: border }]} onPress={prepNextTeamMemberAttempt}>
                <MaterialIcons name="person-add" size={16} color={text} />
                <Text style={[styles.nextMemberButtonText, { color: text }]}>Next Team Member Setup</Text>
              </TouchableOpacity>
            )}
          </View>

          <SectionCard>
            <Text style={[styles.sectionTitle, { color: text }]}>Verified Trial Records Dashboard</Text>
            {attempts.length === 0 ? (
              <Text style={[styles.bullet, { color: mutedText }]}>No aggregated trial scores compiled yet.</Text>
            ) : (
              attempts.map((item, index) => (
                <View key={index} style={[styles.attemptRowListItem, { borderBottomColor: border }]}>
                  <Text style={[styles.body, { color: text, fontWeight: '700' }]}>{item.memberName}</Text>
                  <Text style={[styles.body, { color: mutedText }]}>
                    Phase {item.phase} — {item.phase === 3 ? `Accuracy: ${item.accuracyPercent}% (Lag: ${item.delayMs}ms)` : `Score: ${item.reactionTime}ms (${item.totalHits} hits)`}
                  </Text>
                </View>
              ))
            )}
            {attempts.length > 0 && <PrimaryButton style={{ marginTop: Spacing.md }} label={isSyncing ? 'Uploading...' : 'Upload Records'} onPress={uploadEntireManifestDataset} disabled={isSyncing} />}
          </SectionCard>
        </View>
      )}

      {screenTab === 'discussion' && (
        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>Neuroscience Insights</Text>
          <Text style={[styles.body, { color: mutedText, lineHeight: 19 }]}>
            Grid tapping tasks measures rapid tactile reflex signal pathways. Tracing profiles expand on basic reactions by introducing constant spatial tracking requirements, testing structural hand-eye motor optimization within visual cortex centers.
          </Text>
        </SectionCard>
      )}

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 24 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tabPill: { flex: 1, minHeight: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPillText: { ...Typography.small, fontWeight: '700' },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  body: { ...Typography.body, fontSize: 13 },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13 },
  phaseHeading: { ...Typography.section, fontSize: 14, marginTop: Spacing.sm },
  activityWrap: { gap: Spacing.md },
  phaseIndicatorRow: { flexDirection: 'row', gap: Spacing.sm },
  phasePill: { flex: 1, minHeight: 36, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  phasePillText: { ...Typography.small, fontWeight: '700' },
  phaseTitle: { ...Typography.section, fontSize: 16, marginTop: Spacing.xs },
  instrumentBox: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.md, gap: Spacing.xs },
  inputLabel: { ...Typography.small, fontWeight: '700', marginBottom: 4 },
  inputBoxField: { height: 40, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, fontSize: 13, marginBottom: Spacing.md },
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
  },  
  gridCellElement: { borderRadius: 99, borderWidth: 1 },
  metricsSummaryOutputText: { ...Typography.body, textAlign: 'center', fontWeight: '700', marginTop: Spacing.md, fontSize: 14 },
  attemptRowListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  tracingTargetNode: { position: 'absolute', width: TARGET_SIZE, height: TARGET_SIZE, borderRadius: 99, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  tracingPlaceholderText: { position: 'absolute', width: '100%', textAlign: 'center', top: '46%', ...Typography.small, fontWeight: '600', opacity: 0.4 },
  timerTrackField: { height: 24, width: '100%', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: Radius.sm, overflow: 'hidden', marginBottom: Spacing.md, justifyContent: 'center', position: 'relative' },
  timerProgressBarFill: { height: '100%', left: 0, position: 'absolute', opacity: 0.25 },
  timerPercentageText: { ...Typography.small, fontSize: 11, fontWeight: '700', paddingHorizontal: Spacing.sm, zIndex: 2 },
  actionControlRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  nextMemberButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md, height: 40, marginTop: Spacing.md, backgroundColor: 'rgba(0,0,0,0.01)' },
  nextMemberButtonText: { ...Typography.small, fontWeight: '700' },
  // High-tech Heads-Up Display block for Phase 3 tracking updates
  liveMetricsHUD: { borderWidth: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', marginBottom: Spacing.md },
  hudLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  hudValue: { fontSize: 24, fontWeight: '900', marginTop: 2 }
});