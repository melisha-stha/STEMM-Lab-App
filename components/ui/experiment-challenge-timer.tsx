import { PanelMuted, usePanelTheme } from '@/components/ui/activity-color-panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const EXPERIMENT_CHALLENGE_LIMIT_MS = 25 * 60 * 1000;

export function formatChallengeClock(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

type Props = {
  pixelFamily: string | undefined;
  started: boolean;
  running: boolean;
  finished: boolean;
  remainingMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export function ExperimentChallengeTimer({
  pixelFamily,
  started,
  running,
  finished,
  remainingMs,
  onStart,
  onPause,
  onResume,
  onStop,
}: Props) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');

  const timeTakenMs = EXPERIMENT_CHALLENGE_LIMIT_MS - remainingMs;
  const displayMs = started ? remainingMs : EXPERIMENT_CHALLENGE_LIMIT_MS;
  const isPaused = started && !running && !finished && remainingMs > 0;

  return (
    <View style={[styles.card, { backgroundColor: cardIconBg, borderColor }]}>
      <Text style={[styles.challengeCopy, { color: textColor }]}>
        Up for a challenge? Let&apos;s see how long it takes you to finish this experiment — you
        have 25 minutes!
      </Text>

      <Text
        style={[
          styles.pixelClock,
          { color: borderColor, fontFamily: pixelFamily },
          finished && { color: success },
          !started && styles.pixelClockIdle,
        ]}>
        {formatChallengeClock(displayMs)}
      </Text>

      {started && !finished && (
        <PanelMuted style={styles.statusLine}>
          {running
            ? 'Timer running — complete your drops and upload when ready.'
            : isPaused
              ? 'Timer paused — tap Resume when you are ready to continue.'
              : "Time's up! You can still finish and upload your attempts."}
        </PanelMuted>
      )}

      {finished && (
        <Text style={[styles.finishedLine, { color: success, fontFamily: pixelFamily }]}>
          Challenge complete! Time: {formatChallengeClock(timeTakenMs)}
        </Text>
      )}

      {!started && !finished && (
        <PrimaryButton
          label="Start challenge timer"
          variant="primary"
          style={styles.fullWidthBtn}
          onPress={onStart}
        />
      )}

      {started && !finished && (
        <View style={styles.controlRow}>
          {running ? (
            <PrimaryButton
              label="Pause"
              variant="secondary"
              style={styles.controlBtn}
              onPress={onPause}
            />
          ) : remainingMs > 0 ? (
            <PrimaryButton
              label="Resume"
              variant="primary"
              style={styles.controlBtn}
              onPress={onResume}
            />
          ) : null}
          <PrimaryButton
            label="Stop"
            variant="secondary"
            style={styles.controlBtn}
            onPress={onStop}
          />
        </View>
      )}

      {started && running && !finished && (
        <View style={[styles.liveDotRow, { borderColor }]}>
          <View style={[styles.liveDot, { backgroundColor: primary }]} />
          <Text style={[styles.liveLabel, { color: primary }]}>LIVE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  challengeCopy: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: FontWeight.semibold,
  },
  pixelClock: {
    fontSize: 42,
    letterSpacing: 2,
    marginVertical: Spacing.xs,
  },
  pixelClockIdle: {
    opacity: 0.85,
  },
  statusLine: {
    textAlign: 'center',
    fontSize: FontSize.sm,
  },
  finishedLine: {
    fontSize: FontSize.md,
    textAlign: 'center',
    letterSpacing: 1,
  },
  fullWidthBtn: {
    alignSelf: 'stretch',
    marginTop: Spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  controlBtn: {
    flex: 1,
  },
  liveDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
});
