export const LEADERBOARD_SOURCE_LIMIT = 75;
export const LEADERBOARD_DISPLAY_LIMIT = 10;
export const OVERALL_RANKINGS_DISPLAY_LIMIT = 8;

export const LEADERBOARD_ACTIVITIES = [
  'parachute',
  'sound',
  'handfan',
  'earthquake',
  'performance',
  'reaction',
  'breathing',
] as const;

export type LeaderboardActivity = (typeof LEADERBOARD_ACTIVITIES)[number];

export type LeaderboardRow = {
  id: string;
  teamName?: string;
  grade?: string;
  yearLevel?: string;
  learningLevel?: string;
  teamId?: string | number;
  avatarKey?: string | null;
  userId?: string;
  bestTime?: number;
  measurements?: { db: number; label: string; aboveBaselineDb?: number }[];
  peakDb?: number;
  bestBendAngle?: number;
  bestScore?: number;
  avgReactionTimeMs?: number | null;
  sessionsCount?: number;
  bestControlScore?: number | null;
};

export type OverallTeamStanding = {
  teamKey: string;
  teamName: string;
  teamId?: string | number;
  userId?: string;
  avatarKey?: string | null;
  yearLevel?: string;
  grade?: string;
  totalPoints: number;
  activitiesCompleted: number;
};

const PLACE_POINTS = [10, 8, 6, 5, 4] as const;

export function pointsForActivityRank(rank: number): number {
  if (rank < 1) return 0;
  if (rank <= PLACE_POINTS.length) return PLACE_POINTS[rank - 1];
  return 2;
}

const INVALID_TEAM_NAMES = new Set(['', 'unknown', 'anonymous team', '—', '-', 'n/a']);

export function getLeaderboardTeamKey(row: LeaderboardRow): string {
  if (row.teamId != null && String(row.teamId).trim().length > 0) {
    return `id:${String(row.teamId).trim()}`;
  }
  if (row.userId && String(row.userId).trim().length > 0) {
    return `uid:${String(row.userId).trim()}`;
  }
  const name = String(row.teamName ?? '')
    .trim()
    .toLowerCase();
  if (name && !INVALID_TEAM_NAMES.has(name)) {
    return `name:${name}`;
  }
  return `doc:${row.id}`;
}

export function getLeaderboardDiscriminator(row: LeaderboardRow): string {
  if (row.teamId != null && String(row.teamId).length > 0) {
    return String(row.teamId);
  }
  if (row.userId && row.userId.length >= 6) {
    return row.userId.slice(-6);
  }
  if (row.id && row.id.length >= 6) {
    return row.id.slice(-6);
  }
  return '—';
}

export function getLeaderboardYearLabel(row: LeaderboardRow): string | null {
  const raw = (row.yearLevel ?? row.grade ?? '').toString().trim();
  if (!raw) return null;
  return /^year\s+/i.test(raw) ? raw : `Year ${raw}`;
}

export function getStandingDiscriminator(standing: OverallTeamStanding): string {
  if (standing.teamId != null && String(standing.teamId).length > 0) {
    return String(standing.teamId);
  }
  if (standing.userId && standing.userId.length >= 6) {
    return standing.userId.slice(-6);
  }
  if (standing.teamKey.length >= 6) {
    return standing.teamKey.slice(-6);
  }
  return '—';
}

export function getStandingYearLabel(standing: OverallTeamStanding): string | null {
  const raw = (standing.yearLevel ?? standing.grade ?? '').toString().trim();
  if (!raw) return null;
  return /^year\s+/i.test(raw) ? raw : `Year ${raw}`;
}

function resolveSoundPeakDb(row: LeaderboardRow): number | null {
  if (row.peakDb != null && Number.isFinite(Number(row.peakDb))) {
    return Number(row.peakDb);
  }
  if (Array.isArray(row.measurements) && row.measurements.length > 0) {
    const peak = Math.max(...row.measurements.map((m) => Number(m.db)));
    return Number.isFinite(peak) ? peak : null;
  }
  return null;
}

export function hasValidActivityResult(activity: LeaderboardActivity, row: LeaderboardRow): boolean {
  switch (activity) {
    case 'parachute':
      return row.bestTime != null && Number.isFinite(row.bestTime) && row.bestTime > 0;
    case 'sound':
      return resolveSoundPeakDb(row) != null && (resolveSoundPeakDb(row) as number) > 0;
    case 'handfan': {
      const angle = Number(row.bestBendAngle);
      return Number.isFinite(angle) && angle > 0;
    }
    case 'earthquake':
      return row.bestScore != null && Number.isFinite(row.bestScore);
    case 'performance':
      return row.bestControlScore != null && Number.isFinite(row.bestControlScore);
    case 'reaction':
      return (
        row.avgReactionTimeMs != null &&
        Number.isFinite(row.avgReactionTimeMs) &&
        row.avgReactionTimeMs > 0
      );
    case 'breathing':
      return row.sessionsCount != null && Number.isFinite(row.sessionsCount) && row.sessionsCount > 0;
    default:
      return false;
  }
}

export function isBetterActivityResult(
  activity: LeaderboardActivity,
  candidate: LeaderboardRow,
  incumbent: LeaderboardRow
): boolean {
  switch (activity) {
    case 'parachute':
      return Number(candidate.bestTime ?? 0) > Number(incumbent.bestTime ?? 0);
    case 'sound':
      return (resolveSoundPeakDb(candidate) ?? 0) > (resolveSoundPeakDb(incumbent) ?? 0);
    case 'handfan':
      return Number(candidate.bestBendAngle ?? 0) > Number(incumbent.bestBendAngle ?? 0);
    case 'earthquake':
      return Number(candidate.bestScore ?? 0) > Number(incumbent.bestScore ?? 0);
    case 'performance':
      return Number(candidate.bestControlScore ?? 0) > Number(incumbent.bestControlScore ?? 0);
    case 'reaction':
      return Number(candidate.avgReactionTimeMs ?? Infinity) < Number(incumbent.avgReactionTimeMs ?? Infinity);
    case 'breathing':
      return Number(candidate.sessionsCount ?? 0) > Number(incumbent.sessionsCount ?? 0);
    default:
      return false;
  }
}

export function compareActivityResults(
  activity: LeaderboardActivity,
  a: LeaderboardRow,
  b: LeaderboardRow
): number {
  if (activity === 'reaction') {
    return Number(a.avgReactionTimeMs ?? Infinity) - Number(b.avgReactionTimeMs ?? Infinity);
  }
  if (activity === 'parachute') {
    return Number(b.bestTime ?? 0) - Number(a.bestTime ?? 0);
  }
  if (activity === 'sound') {
    return (resolveSoundPeakDb(b) ?? 0) - (resolveSoundPeakDb(a) ?? 0);
  }
  if (activity === 'handfan') {
    return Number(b.bestBendAngle ?? 0) - Number(a.bestBendAngle ?? 0);
  }
  if (activity === 'earthquake') {
    return Number(b.bestScore ?? 0) - Number(a.bestScore ?? 0);
  }
  if (activity === 'performance') {
    return Number(b.bestControlScore ?? 0) - Number(a.bestControlScore ?? 0);
  }
  if (activity === 'breathing') {
    return Number(b.sessionsCount ?? 0) - Number(a.sessionsCount ?? 0);
  }
  return 0;
}

export function dedupeBestPerTeam(
  activity: LeaderboardActivity,
  rows: LeaderboardRow[]
): LeaderboardRow[] {
  const bestByTeam = new Map<string, LeaderboardRow>();

  for (const row of rows) {
    if (!hasValidActivityResult(activity, row)) continue;

    const teamKey = getLeaderboardTeamKey(row);
    const existing = bestByTeam.get(teamKey);
    if (!existing || isBetterActivityResult(activity, row, existing)) {
      bestByTeam.set(teamKey, row);
    }
  }

  return Array.from(bestByTeam.values()).sort((a, b) => compareActivityResults(activity, a, b));
}

export function getActivityMetric(
  activity: LeaderboardActivity,
  result: LeaderboardRow
): { primary: string; label: string } {
  switch (activity) {
    case 'parachute':
      return {
        primary: result.bestTime != null ? `${(result.bestTime / 1000).toFixed(2)}s` : '—',
        label: 'Longest drop time',
      };
    case 'sound': {
      const peakDb = resolveSoundPeakDb(result) ?? 0;
      return {
        primary: `${peakDb.toFixed(1)} dB`,
        label: 'Highest estimated sound reading',
      };
    }
    case 'handfan':
      return {
        primary:
          result.bestBendAngle != null ? `${Number(result.bestBendAngle).toFixed(0)}°` : '—',
        label: 'Largest bend angle',
      };
    case 'earthquake':
      return {
        primary: result.bestScore != null ? `${result.bestScore}/100` : '—',
        label: 'Highest stability score',
      };
    case 'performance':
      return {
        primary: result.bestControlScore != null ? `${result.bestControlScore}` : '—',
        label: 'Highest control score',
      };
    case 'reaction':
      return {
        primary: result.avgReactionTimeMs != null ? `${result.avgReactionTimeMs} ms` : '—',
        label: 'Fastest average reaction',
      };
    case 'breathing':
      return {
        primary: result.sessionsCount != null ? `${result.sessionsCount}` : '0',
        label: 'Sessions recorded',
      };
  }
}

export function computeOverallStandings(
  activityResults: Partial<Record<LeaderboardActivity, LeaderboardRow[]>>
): OverallTeamStanding[] {
  const totals = new Map<string, OverallTeamStanding>();

  for (const activity of LEADERBOARD_ACTIVITIES) {
    const ranked = activityResults[activity] ?? [];
    ranked.forEach((row, index) => {
      const rank = index + 1;
      const points = pointsForActivityRank(rank);
      const teamKey = getLeaderboardTeamKey(row);
      const existing = totals.get(teamKey);

      const next: OverallTeamStanding = existing
        ? {
            ...existing,
            totalPoints: existing.totalPoints + points,
            activitiesCompleted: existing.activitiesCompleted + 1,
            teamName: existing.teamName || row.teamName || `Team ${getLeaderboardDiscriminator(row)}`,
            avatarKey: existing.avatarKey ?? row.avatarKey ?? null,
            yearLevel: existing.yearLevel ?? row.yearLevel,
            grade: existing.grade ?? row.grade,
          }
        : {
            teamKey,
            teamName: row.teamName || `Team ${getLeaderboardDiscriminator(row)}`,
            teamId: row.teamId,
            userId: row.userId,
            avatarKey: row.avatarKey ?? null,
            yearLevel: row.yearLevel,
            grade: row.grade,
            totalPoints: points,
            activitiesCompleted: 1,
          };

      totals.set(teamKey, next);
    });
  }

  return Array.from(totals.values())
    .filter((row) => row.totalPoints > 0 && row.activitiesCompleted > 0)
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.activitiesCompleted - a.activitiesCompleted;
    });
}

export function prepareActivityLeaderboard(
  activity: LeaderboardActivity,
  rows: LeaderboardRow[]
): LeaderboardRow[] {
  return dedupeBestPerTeam(activity, rows).slice(0, LEADERBOARD_DISPLAY_LIMIT);
}
