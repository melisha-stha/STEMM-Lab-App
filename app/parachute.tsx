import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AttemptRow } from '@/components/ui/attempt-row';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ParachuteScreen() {
  const router = useRouter();
  
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(0); 
  const [attempts, setAttempts] = useState<number[]>([]); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');
  
  // Function to record the current time (Task B3.2)
  const recordAttempt = () => {
    if (time > 0 && attempts.length < 3) {
      setAttempts([...attempts, time]);
    }
  };

  // Timer "Engine" 
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 10);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  // Format milliseconds to 00.00 
  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  // Clear all data 
  const resetAll = () => {
    setIsActive(false);
    setTime(0);
    setAttempts([]);
  };

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Parachute Drop</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Run 1–3 trials. Compare results. Improve your design.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Instructions</Text>
        <View style={[styles.bullets, { borderTopColor: border }]}>
          <Text style={[styles.bullet, { color: mutedText }]}>• Use a consistent drop height.</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Start the timer as you release the toy.
          </Text>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Stop when it hits the ground, then record the attempt.
          </Text>
        </View>
      </SectionCard>

      <View style={[styles.timerPanel, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.timerLabel, { color: mutedText }]}>Timer</Text>
        <Text style={[styles.timerValue, { color: text }]}>{formatTime(time)}s</Text>

        <View style={styles.timerButtons}>
          <PrimaryButton
            label={isActive ? 'Stop & record' : 'Start timer'}
            variant={isActive ? 'danger' : 'primary'}
            onPress={() => {
              if (isActive) recordAttempt();
              setIsActive(!isActive);
            }}
          />
          <PrimaryButton
            label="Reset"
            variant="secondary"
            onPress={resetAll}
            disabled={time === 0 && attempts.length === 0}
          />
        </View>

        <View style={styles.helperRow}>
          <Text style={[styles.helper, { color: mutedText }]}>
            Attempts recorded: {attempts.length}/3
          </Text>
          <Text style={[styles.helper, { color: primary }]}>
            Best: {attempts.length ? `${formatTime(Math.min(...attempts))}s` : '—'}
          </Text>
        </View>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Results</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No drops recorded yet. Run a trial and tap “Stop & record”.
          </Text>
        ) : (
          <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
            {attempts.map((val, i) => (
              <AttemptRow
                key={i}
                index={i + 1}
                value={`${formatTime(val)}s`}
                isLast={i === attempts.length - 1}
              />
            ))}
          </View>
        )}
      </SectionCard>

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },

  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },

  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bullets: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    gap: 6,
  },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },

  timerPanel: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  timerLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  timerValue: {
    marginTop: Spacing.sm,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  timerButtons: { marginTop: Spacing.md, gap: Spacing.sm },

  helperRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helper: { ...Typography.small },

  attemptsWrap: { borderTopWidth: 1, paddingTop: Spacing.xs },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },
});