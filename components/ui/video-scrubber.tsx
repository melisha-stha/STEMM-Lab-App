import { usePanelFieldColors } from '@/components/ui/activity-color-panel';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ResizeMode, Video } from 'expo-av';
import React, { useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const HELP = {
  playback: {
    title: 'Frames & playback',
    message:
      'Your clip is slow-motion (240 fps). Each frame is one snapshot — use Play/Pause, then -10f / +10f to land on the exact frame.\n\n' +
      '1× is normal speed. 0.5× and 0.25× play slower so you can spot the right moment. Tap the timeline bar to jump to a point.',
  },
  release: {
    title: 'Mark Release',
    message: 'Pause on the frame where you let go of the parachute / toy — the instant it leaves your hand.',
  },
  impact: {
    title: 'Mark Impact',
    message: 'Pause on the first frame where it touches the ground. Not a later bounce — only the first contact.',
  },
  stopped: {
    title: 'Mark Stopped',
    message: 'Pause when it has fully stopped moving (no more sliding, wobble, or bouncing).',
  },
  bounce: {
    title: 'Static vs kinetic bounce',
    message:
      'Static (no bounce): lands and stays down with no rebound.\n\n' +
      'Kinetic bounce: it bounces back up after impact.\n\n' +
      'Mark bounce apex: only if kinetic — pause at the highest point of the rebound, not the landing frame.',
  },
} as const;

function HelpButton({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Show help"
      hitSlop={8}
      onPress={onPress}
      style={styles.helpBtn}>
      <MaterialIcons name="help-outline" size={20} color={color} />
    </Pressable>
  );
}

const ULTRA_SLOW_FPS = 240; //

export type VideoFrameMarkers = {
  releaseFrame: number | null;
  impactFrame: number | null;
  stopFrame: number | null;
  maxBounceFrame: number | null;
};

type Props = {
  uri: string;
  onMarkersChange: (markers: VideoFrameMarkers, mode: 'no_bounce' | 'bounced') => void;
};

const SPEEDS = [
  { label: '1×', value: 1.0 },
  { label: '0.5×', value: 0.5 },
  { label: '0.25×', value: 0.25 },
];

const fmtTime = (ms: number): string => `${(ms / 1000).toFixed(3)}s`;

export function VideoScrubber({ uri, onMarkersChange }: Props) {
  const videoRef = useRef<Video>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [scrubBarWidth, setScrubBarWidth] = useState(1);
  const [bounceMode, setBounceMode] = useState<'no_bounce' | 'bounced'>('no_bounce');
  
  const [markers, setMarkers] = useState<VideoFrameMarkers>({
    releaseFrame: null,
    impactFrame: null,
    stopFrame: null,
    maxBounceFrame: null,
  });

  const { foreground: text, muted: mutedText, surface: card, border, onPanel } =
    usePanelFieldColors();
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const danger = useThemeColor({}, 'danger');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const currentFrameIndex = Math.floor((positionMs / 1000) * ULTRA_SLOW_FPS);
  const totalFrameCount = Math.floor((durationMs / 1000) * ULTRA_SLOW_FPS);

  const seekToMs = async (ms: number) => {
    const clamped = Math.max(0, Math.min(ms, durationMs));
    await videoRef.current?.setPositionAsync(clamped, {
      toleranceMillisBefore: 0,
      toleranceMillisAfter: 0,
    });
    setPositionMs(clamped);
  };

  const seekToFrame = async (frame: number) => {
    if (durationMs <= 0) return;
    await seekToMs(Math.round((frame / ULTRA_SLOW_FPS) * 1000));
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

  const changeSpeed = async (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying) await videoRef.current?.setRateAsync(newSpeed, true);
  };

  const handleScrubBarPress = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(x / scrubBarWidth, 1));
    seekToMs(Math.round(ratio * durationMs));
  };

  const updateMarkers = (updated: VideoFrameMarkers, mode = bounceMode) => {
    setMarkers(updated);
    onMarkersChange(updated, mode);
  };

  const markEvent = (key: keyof VideoFrameMarkers) => {
    const updated = { ...markers, [key]: currentFrameIndex };
    updateMarkers(updated);
  };

  const clearMarker = (key: keyof VideoFrameMarkers) => {
    const updated = { ...markers, [key]: null };
    updateMarkers(updated);
  };

  const toggleBounceMode = (mode: 'no_bounce' | 'bounced') => {
    setBounceMode(mode);
    const updated = { ...markers, maxBounceFrame: mode === 'no_bounce' ? null : markers.maxBounceFrame };
    updateMarkers(updated, mode);
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const CORE_STEPS = [
    {
      key: 'releaseFrame' as const,
      label: 'Mark Release',
      color: primary,
      textColor: onPrimary,
      help: HELP.release,
    },
    {
      key: 'impactFrame' as const,
      label: 'Mark Impact',
      color: success,
      textColor: '#fff',
      help: HELP.impact,
    },
    {
      key: 'stopFrame' as const,
      label: 'Mark Stopped',
      color: warning,
      textColor: '#000',
      help: HELP.stopped,
    },
  ];

  const checkUnlocked = (key: string): boolean => {
    if (key === 'releaseFrame') return true;
    if (key === 'impactFrame') return markers.releaseFrame !== null;
    if (key === 'stopFrame') return markers.impactFrame !== null;
    if (key === 'maxBounceFrame') return markers.impactFrame !== null;
    return false;
  };

return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        onPlaybackStatusUpdate={status => {
          if (!status.isLoaded) return;
          setPositionMs(status.positionMillis ?? 0);
          setDurationMs(status.durationMillis ?? 0);
          setIsPlaying(status.didJustFinish ? false : status.isPlaying);
        }}
      />

      <Pressable style={[styles.scrubBar, { backgroundColor: border }]} onLayout={e => setScrubBarWidth(e.nativeEvent.layout.width)} onPress={handleScrubBarPress}>
        <View style={[styles.scrubFill, { width: `${progress * 100}%`, backgroundColor: primary }]} />
        {[...CORE_STEPS, { key: 'maxBounceFrame' as const, color: danger }].map(step => {
          const frame = markers[step.key];
          return frame !== null && totalFrameCount > 0 ? (
            <View key={step.key} style={[styles.markerDot, { left: `${(frame / totalFrameCount) * 100}%`, backgroundColor: step.color }]} />
          ) : null;
        })}
      </Pressable>

      <Text style={[styles.timeLabel, { color: mutedText, opacity: onPanel ? 0.8 : 1 }]}>
        Frame: {currentFrameIndex}f / {totalFrameCount}f ({fmtTime(positionMs)})
      </Text>

      {/* Universal Media Deck Control Elements */}
      <View style={styles.controls}>
        {/* Step Backward 10 Frames */}
        <Pressable 
          style={[styles.stepActionBtn, { backgroundColor: card, borderColor: border }]} 
          onPress={() => void seekToFrame(currentFrameIndex - 10)}
        >
          <Text style={[styles.stepBtnText, { color: text }]}>《 -10f</Text>
        </Pressable>

        {/* Master Play Engine Toggle */}
        <Pressable style={[styles.playbackEngineTrigger, { backgroundColor: primary }]} onPress={togglePlay}>
          <Text style={[styles.playbackTriggerText, { color: onPrimary }]}>
            {isPlaying ? 'Pause' : positionMs >= durationMs - 100 ? 'Replay' : 'Play'}
          </Text>
        </Pressable>

        {/* Step Forward 10 Frames */}
        <Pressable 
          style={[styles.stepActionBtn, { backgroundColor: card, borderColor: border }]} 
          onPress={() => void seekToFrame(currentFrameIndex + 10)}
        >
          <Text style={[styles.stepBtnText, { color: text }]}>+10f 》</Text>
        </Pressable>
      </View>

      <View style={styles.speedRow}>
        <View style={styles.speedPills}>
          {SPEEDS.map(s => (
            <Pressable
              key={s.value}
              onPress={() => void changeSpeed(s.value)}
              style={[
                styles.speedPill,
                { backgroundColor: speed === s.value ? primary : card, borderColor: border },
              ]}>
              <Text style={[styles.speedPillText, { color: speed === s.value ? onPrimary : mutedText }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <HelpButton
          color={primary}
          onPress={() => Alert.alert(HELP.playback.title, HELP.playback.message)}
        />
      </View>

      <View style={[styles.markerSection, { borderTopColor: border }]}>
        {CORE_STEPS.map(step => {
          const isSet = markers[step.key] !== null;
          const unlocked = checkUnlocked(step.key);
          return (
            <View key={step.key} style={styles.markerRow}>
              <Pressable
                disabled={!unlocked}
                onPress={() => markEvent(step.key)}
                style={[
                  styles.markerBtn,
                  { backgroundColor: isSet ? step.color : card, borderColor: border, opacity: unlocked ? 1 : 0.4 },
                ]}>
                <Text style={[styles.markerBtnText, { color: isSet ? step.textColor : text }]}>{step.label}</Text>
              </Pressable>
              <HelpButton color={primary} onPress={() => Alert.alert(step.help.title, step.help.message)} />
              {isSet && (
                <View style={styles.resultBadge}>
                  <Text style={{ color: step.color, fontWeight: 'bold', fontSize: 12 }}>f {markers[step.key]}</Text>
                  <TouchableOpacity onPress={() => clearMarker(step.key)}><Text style={{ color: danger, fontSize: 11, marginLeft: 6 }}>Clear</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Embedded Physics Case Switcher */}
        {markers.stopFrame !== null && (
          <View style={[styles.inlineProfileStack, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.profileHeadingRow}>
              <Text style={[styles.profileHeading, { color: text }]}>Collision Rebound Profile</Text>
              <HelpButton
                color={primary}
                onPress={() => Alert.alert(HELP.bounce.title, HELP.bounce.message)}
              />
            </View>
            <View style={styles.toggleRow}>
              <Pressable onPress={() => toggleBounceMode('no_bounce')} style={[styles.togglePill, { backgroundColor: bounceMode === 'no_bounce' ? primary : card, borderColor: border }]}>
                <Text style={{ color: bounceMode === 'no_bounce' ? onPrimary : text, fontSize: 12, fontWeight: '600' }}>Static (No Bounce)</Text>
              </Pressable>
              <Pressable onPress={() => toggleBounceMode('bounced')} style={[styles.togglePill, { backgroundColor: bounceMode === 'bounced' ? primary : card, borderColor: border }]}>
                <Text style={{ color: bounceMode === 'bounced' ? onPrimary : text, fontSize: 12, fontWeight: '600' }}>Kinetic Bounce</Text>
              </Pressable>
            </View>

            {/* Progressive Disclosure Variable Field */}
            {bounceMode === 'bounced' && (
              <View style={styles.markerRow}>
                <Pressable disabled={!checkUnlocked('maxBounceFrame')} onPress={() => markEvent('maxBounceFrame')} style={[styles.markerBtn, { backgroundColor: markers.maxBounceFrame ? danger : card, borderColor: border }]}>
                  <Text style={[styles.markerBtnText, { color: markers.maxBounceFrame ? '#fff' : text }]}>Mark Bounce Apex height</Text>
                </Pressable>
                {markers.maxBounceFrame !== null && (
                  <View style={styles.resultBadge}>
                    <Text style={{ color: danger, fontWeight: 'bold', fontSize: 12 }}>f {markers.maxBounceFrame}</Text>
                    <TouchableOpacity onPress={() => clearMarker('maxBounceFrame')}><Text style={{ color: danger, fontSize: 11, marginLeft: 6 }}>Clear</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  video: { width: '100%', height: 220, borderRadius: Radius.lg, backgroundColor: '#000' },
  scrubBar: { height: 8, borderRadius: Radius.pill, overflow: 'visible', position: 'relative' },
  scrubFill: { height: '100%', borderRadius: Radius.pill },
  markerDot: { position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, marginLeft: -9, borderWidth: 2, borderColor: '#fff' },
  timeLabel: { ...Typography.small, textAlign: 'center', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', justifyContent: 'space-between' },
  stepActionBtn: { flex: 1, minHeight: 44, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { ...Typography.small, fontWeight: '700', fontSize: 11 },
  playbackEngineTrigger: { flex: 2, minHeight: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  playbackTriggerText: { ...Typography.body, fontWeight: '700', fontSize: 13 },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  speedPills: { flexDirection: 'row', gap: Spacing.xs, flexShrink: 1, justifyContent: 'center' },
  speedPill: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1 },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedPillText: { ...Typography.small, fontWeight: '700' },
  markerSection: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  markerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 2 },
  markerBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    marginRight: Spacing.xs,
  },
  markerBtnText: { ...Typography.small, fontWeight: '700' },
  resultBadge: { flexDirection: 'row', alignItems: 'center', minWidth: 80, justifyContent: 'flex-end' },
  inlineProfileStack: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, gap: Spacing.xs },
  profileHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileHeading: { ...Typography.small, fontWeight: 'bold', flex: 1 },
  toggleRow: { flexDirection: 'row', gap: Spacing.xs, marginVertical: 2 },
  togglePill: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});