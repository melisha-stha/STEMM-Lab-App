import { formatLocaleDateTime } from '@/utils/formatters/date';

import {
  getBreathingResults,
  getEarthquakeResults,
  getHandFanResults,
  getParachuteResults,
  getPerformanceResults,
  getReactionResults,
  getSoundResults,
} from '@/hooks/storage';

export type LabJournalEntry = {
  id: string;
  activityKey: string;
  activityName: string;
  reflectionText: string;
  resultSummary: string;
  createdAt: number;
  teamName: string;
  teamId?: string | number | null;
};

type ActivityJournalSource = {
  activityKey: string;
  activityName: string;
  load: () => Promise<unknown>;
};

const PLACEHOLDER_TEAM_NAMES = new Set(['—', '-', 'n/a', 'na', 'none']);

const ACTIVITY_SOURCES: ActivityJournalSource[] = [
  { activityKey: 'parachute', activityName: 'Parachute Drop', load: getParachuteResults },
  { activityKey: 'sound', activityName: 'Sound Pollution Hunter', load: getSoundResults },
  { activityKey: 'earthquake', activityName: 'Earthquake Structure', load: getEarthquakeResults },
  { activityKey: 'reaction', activityName: 'Reaction Board', load: getReactionResults },
  { activityKey: 'breathing', activityName: 'Breathing Pace Trainer', load: getBreathingResults },
  { activityKey: 'handfan', activityName: 'Hand Fan Challenge', load: getHandFanResults },
  {
    activityKey: 'performance',
    activityName: 'Human Performance Lab',
    load: getPerformanceResults,
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function normalizeTeamName(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || PLACEHOLDER_TEAM_NAMES.has(normalized)) return '';
  return normalized;
}

function hasTeamId(value: unknown): boolean {
  if (value == null) return false;
  const asString = String(value).trim();
  return asString.length > 0;
}

/**
 * Strict team match: prefer teamId when both sides have it; otherwise case-insensitive teamName.
 * Excludes reflections with no team identifiers or that belong to another team.
 */
export function belongsToCurrentTeam(
  payload: Record<string, unknown>,
  teamName: string | null | undefined,
  teamId: number | string | null | undefined
): boolean {
  const currentName = normalizeTeamName(teamName);
  const storedName = normalizeTeamName(payload.teamName);
  const storedId = payload.teamId;
  const hasStoredId = hasTeamId(storedId);
  const hasCurrentId = hasTeamId(teamId);

  if (!hasStoredId && !storedName) {
    return false;
  }

  if (hasStoredId && hasCurrentId) {
    return String(storedId) === String(teamId);
  }

  if (hasStoredId && !hasCurrentId) {
    return false;
  }

  if (!hasStoredId && hasCurrentId) {
    if (!storedName || !currentName) return false;
    return storedName === currentName;
  }

  if (storedName && currentName) {
    return storedName === currentName;
  }

  return false;
}

function getReflectionText(payload: Record<string, unknown>): string {
  const raw =
    payload.comment ?? payload.reflection ?? payload.reflectionText ?? payload.note ?? '';
  return String(raw).trim();
}

function getBestHandFanBendDeg(payload: Record<string, unknown>): number | null {
  const attempts = payload.attempts;
  if (!Array.isArray(attempts)) return null;

  let best: number | null = null;
  for (const item of attempts) {
    const row = asRecord(item);
    if (!row) continue;
    const deg = Number.parseFloat(String(row.bendAngleDeg ?? ''));
    if (!Number.isFinite(deg)) continue;
    if (best == null || deg > best) best = deg;
  }
  return best;
}

function getReactionAverageMs(payload: Record<string, unknown>): number | null {
  const direct = Number(payload.avgReactionTimeMs);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const phaseValues = [
    payload.avgPhase1ReactionTime,
    payload.avgPhase2ReactionTime,
    payload.avgPhase3ReactionTime,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!phaseValues.length) {
    const best = Number(payload.bestReactionTime);
    if (Number.isFinite(best) && best > 0) return Math.round(best);
    return null;
  }

  const total = phaseValues.reduce((sum, value) => sum + value, 0);
  return Math.round(total / phaseValues.length);
}

function buildResultSummary(activityKey: string, payload: Record<string, unknown>): string {
  switch (activityKey) {
    case 'parachute': {
      const bestTime = Number(payload.bestTime);
      if (Number.isFinite(bestTime) && bestTime > 0) {
        return `Best drop time: ${bestTime.toFixed(2)}s`;
      }
      break;
    }
    case 'sound': {
      const peak = payload.highestDb ?? payload.peakDb;
      const peakNum = Number(peak);
      if (Number.isFinite(peakNum)) return `Peak sound: ${peakNum} dB`;
      break;
    }
    case 'earthquake': {
      const score = Number(payload.bestScore);
      if (Number.isFinite(score)) return `Stability score: ${score}/100`;
      break;
    }
    case 'reaction': {
      const avgMs = getReactionAverageMs(payload);
      if (avgMs != null) return `Average reaction: ${avgMs}ms`;
      break;
    }
    case 'breathing': {
      const sessions = payload.sessions;
      if (Array.isArray(sessions) && sessions.length > 0) {
        return 'Breathing sessions completed';
      }
      const resting = Number(payload.restingBpm);
      if (Number.isFinite(resting) && resting > 0) {
        return `At-rest breathing: ${resting} BPM`;
      }
      break;
    }
    case 'handfan': {
      const bend = getBestHandFanBendDeg(payload);
      if (bend != null) return `Best bend angle: ${bend}°`;
      const force = Number(payload.peakForceN);
      if (Number.isFinite(force) && force > 0) return `Peak fan force: ${force} N`;
      break;
    }
    case 'performance': {
      const avgForce = Number(payload.bestAverageForce);
      if (Number.isFinite(avgForce)) {
        const smoothness = Math.max(0, Math.min(100, Math.round((1 - avgForce) * 100)));
        return `Smoothness score: ${smoothness}/100`;
      }
      const control = Number(payload.bestControlScore);
      if (Number.isFinite(control)) return `Smoothness score: ${control}/100`;
      break;
    }
    default:
      break;
  }
  return 'Result saved';
}

function normalizeJournalEntry(
  raw: unknown,
  source: ActivityJournalSource,
  index: number,
  teamDisplayName: string
): LabJournalEntry | null {
  const payload = asRecord(raw);
  if (!payload) return null;

  const reflectionText = getReflectionText(payload);
  if (!reflectionText) return null;

  const createdAt = Number(payload.createdAt);
  const safeCreatedAt = Number.isFinite(createdAt) ? createdAt : 0;
  const storedTeamName = String(payload.teamName ?? '').trim();
  const teamName =
    storedTeamName && !PLACEHOLDER_TEAM_NAMES.has(storedTeamName.toLowerCase())
      ? storedTeamName
      : teamDisplayName;

  return {
    id: `${source.activityKey}-${safeCreatedAt}-${index}`,
    activityKey: source.activityKey,
    activityName: source.activityName,
    reflectionText,
    resultSummary: buildResultSummary(source.activityKey, payload),
    createdAt: safeCreatedAt,
    teamName: teamName || 'Your team',
    teamId: hasTeamId(payload.teamId)
      ? (typeof payload.teamId === 'string' || typeof payload.teamId === 'number'
          ? payload.teamId
          : String(payload.teamId))
      : null,
  };
}

async function loadActivityHistory(load: () => Promise<unknown>): Promise<unknown[]> {
  try {
    const rows = await load();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Loads local reflection history for the current team only (device storage). */
export async function loadLabJournalEntries(
  teamName: string | null | undefined,
  teamId: number | string | null | undefined
): Promise<LabJournalEntry[]> {
  const hasCurrentId = hasTeamId(teamId);
  const currentName = normalizeTeamName(teamName);
  if (!hasCurrentId && !currentName) {
    return [];
  }

  const teamDisplayName = String(teamName ?? '').trim() || 'Your team';
  const merged: LabJournalEntry[] = [];

  for (const source of ACTIVITY_SOURCES) {
    const history = await loadActivityHistory(source.load);

    history.forEach((item, index) => {
      const payload = asRecord(item);
      if (!payload || !belongsToCurrentTeam(payload, teamName, teamId)) return;

      const entry = normalizeJournalEntry(item, source, index, teamDisplayName);
      if (entry) merged.push(entry);
    });
  }

  return merged.sort((a, b) => {
    const byDate = b.createdAt - a.createdAt;
    if (byDate !== 0) return byDate;
    const byActivity = a.activityKey.localeCompare(b.activityKey);
    if (byActivity !== 0) return byActivity;
    return a.id.localeCompare(b.id);
  });
}

export function formatLabJournalSavedAt(createdAt: number): string | null {
  return formatLocaleDateTime(createdAt);
}
