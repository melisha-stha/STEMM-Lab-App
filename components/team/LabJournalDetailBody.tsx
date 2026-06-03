import { InfoRow } from '@/components/ui/info-row';
import { Radius, Spacing, Typography } from '@/constants/design';
import { formatCentisecondsTimer } from '@/utils/formatters/duration';
import { buildResultSummary, getReflectionText } from '@/utils/formatters/lab-journal';
import { shortDesignLabel } from '@/utils/formatters/metrics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function DetailRow({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor, opacity: 0.85 }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

type Props = {
  activityKey: string;
  payload: Record<string, unknown>;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  cardColor: string;
};

function DetailPanel({
  title,
  children,
  panelBg,
  panelBorder,
  titleColor,
}: {
  title: string;
  children: React.ReactNode;
  panelBg: string;
  panelBorder: string;
  titleColor: string;
}) {
  return (
    <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
      {children}
    </View>
  );
}

export function LabJournalDetailBody({ activityKey, payload, textColor, mutedColor, borderColor, cardColor }: Props) {
  const reflection = getReflectionText(payload);
  const summary = buildResultSummary(activityKey, payload);

  const DataRow = ({ label, value }: { label: string; value: string }) => (
    <DetailRow label={label} value={value} labelColor={mutedColor} valueColor={textColor} />
  );

  const renderActivityData = () => {
    switch (activityKey) {
      case 'parachute': {
        const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
        return (
          <View style={styles.listGap}>
            {attempts.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              const drop = Number(row.dropTimeSec ?? row.time);
              const g = Number(row.gForce);
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>Attempt {index + 1}</Text>
                  <DataRow
                    label="Drop time"
                    value={Number.isFinite(drop) ? `${drop.toFixed(2)} s` : '—'}
                  />
                  <DataRow label="Impact g-force" value={Number.isFinite(g) ? `${g} g` : '—'} />
                </View>
              );
            })}
          </View>
        );
      }
      case 'sound': {
        const measurements = Array.isArray(payload.measurements) ? payload.measurements : [];
        const peak = payload.highestDb ?? payload.peakDb;
        return (
          <View style={styles.listGap}>
            <DataRow
              label="Peak level"
              value={peak != null ? `${peak} dB (estimated)` : '—'}
            />
            {measurements.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <DataRow label="Action" value={String(row.label ?? `Reading ${index + 1}`)} />
                  <DataRow label="Level" value={`${row.db ?? '—'} dB`} />
                </View>
              );
            })}
          </View>
        );
      }
      case 'earthquake': {
        const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
        return (
          <View style={styles.listGap}>
            {attempts.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              const duration = Number(row.duration);
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <DataRow label="Design" value={shortDesignLabel(String(row.designName ?? '—'))} />
                  <DataRow label="Stability score" value={`${row.score ?? '—'}/100`} />
                  <DataRow
                    label="Duration"
                    value={Number.isFinite(duration) ? `${formatCentisecondsTimer(duration)}s` : '—'}
                  />
                </View>
              );
            })}
          </View>
        );
      }
      case 'reaction': {
        const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
        return (
          <View style={styles.listGap}>
            <DataRow label="Phase 1 avg" value={payload.avgPhase1ReactionTime != null ? `${payload.avgPhase1ReactionTime} ms` : '—'} />
            <DataRow label="Phase 2 avg" value={payload.avgPhase2ReactionTime != null ? `${payload.avgPhase2ReactionTime} ms` : '—'} />
            <DataRow label="Phase 3" value={payload.avgPhase3ReactionTime != null ? `${payload.avgPhase3ReactionTime} ms` : '—'} />
            <DataRow label="Best reaction" value={payload.bestReactionTime != null ? `${payload.bestReactionTime} ms` : '—'} />
            {attempts.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <DataRow label="Phase" value={String(row.phase ?? '—')} />
                  <DataRow label="Reaction time" value={`${row.reactionTime ?? row.delayMs ?? '—'} ms`} />
                </View>
              );
            })}
          </View>
        );
      }
      case 'breathing': {
        const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
        return (
          <View style={styles.listGap}>
            <DataRow label="At rest" value={payload.restingBpm != null ? `${payload.restingBpm} BPM` : '—'} />
            <DataRow label="After exercise 1" value={payload.exercise1Bpm != null ? `${payload.exercise1Bpm} BPM` : '—'} />
            <DataRow label="After exercise 2" value={payload.exercise2Bpm != null ? `${payload.exercise2Bpm} BPM` : '—'} />
            {sessions.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <DataRow label="Session" value={String(row.label ?? `Session ${index + 1}`)} />
                  <DataRow label="BPM" value={String(row.bpm ?? '—')} />
                </View>
              );
            })}
          </View>
        );
      }
      case 'handfan': {
        const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
        return (
          <View style={styles.listGap}>
            <DataRow label="Peak force" value={payload.peakForceN != null ? `${payload.peakForceN} N` : '—'} />
            {attempts.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <DataRow label="Design" value={String(row.designName ?? '—')} />
                  <DataRow label="Material" value={String(row.materialLabel ?? '—')} />
                  <DataRow label="Distance" value={String(row.distance ?? '—')} />
                  <DataRow label="Bend angle" value={`${row.bendAngleDeg ?? '—'}°`} />
                  <DataRow label="Force" value={`${row.computedForceN ?? '—'} N`} />
                </View>
              );
            })}
          </View>
        );
      }
      case 'performance': {
        const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
        return (
          <View style={styles.listGap}>
            <DataRow label="Best smoothness" value={summary} />
            {attempts.map((raw, index) => {
              const row = asRecord(raw);
              if (!row) return null;
              return (
                <View key={index} style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
                  <DataRow label="Student" value={String(row.memberName ?? '—')} />
                  <DataRow label="Movement" value={String(row.movement ?? '—')} />
                  <DataRow label="Peak force" value={String(row.peakForce ?? '—')} />
                  <DataRow label="Average force" value={String(row.averageForce ?? '—')} />
                  <DataRow label="Duration" value={`${row.durationSec ?? '—'} s`} />
                </View>
              );
            })}
          </View>
        );
      }
      default:
        return (
          <Text style={[styles.placeholder, { color: mutedColor }]}>
            No detailed layout for this activity yet.
          </Text>
        );
    }
  };

  const panelBg = cardColor;
  const panelBorder = borderColor;

  return (
    <View style={styles.wrap}>
      <DetailPanel title="Result summary" panelBg={panelBg} panelBorder={panelBorder} titleColor={textColor}>
        <Text style={[styles.summary, { color: textColor }]}>{summary}</Text>
      </DetailPanel>

      <DetailPanel title="Activity data" panelBg={panelBg} panelBorder={panelBorder} titleColor={textColor}>
        {renderActivityData()}
      </DetailPanel>

      {reflection ? (
        <DetailPanel title="Saved reflection" panelBg={panelBg} panelBorder={panelBorder} titleColor={textColor}>
          <View style={[styles.reflectionBox, { borderLeftColor: panelBorder }]}>
            <Text style={[styles.reflection, { color: textColor }]}>{reflection}</Text>
          </View>
        </DetailPanel>
      ) : null}

      <DetailPanel title="Team info" panelBg={panelBg} panelBorder={panelBorder} titleColor={textColor}>
        <InfoRow
          label="Team"
          value={String(payload.teamName ?? '—')}
          labelColor={mutedColor}
          valueColor={textColor}
          borderColor={borderColor}
        />
        <InfoRow
          label="Grade"
          value={String(payload.grade ?? '—')}
          labelColor={mutedColor}
          valueColor={textColor}
          borderColor={borderColor}
        />
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  panel: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.xs },
  summary: { ...Typography.body, fontWeight: '700' },
  reflectionBox: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
  },
  reflection: { ...Typography.body, lineHeight: 22, fontWeight: '500' },
  listGap: { gap: Spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  rowLabel: { ...Typography.small, flex: 1 },
  rowValue: { ...Typography.small, fontWeight: '700', textAlign: 'right', flex: 1 },
  placeholder: { ...Typography.body, fontStyle: 'italic' },
});
