export type LearningTier = 'upper_primary' | 'lower_secondary';

export function parseYearNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const match = s.match(/(\d{1,2})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolves primary vs secondary experience for lab activities.
 * Team setting `learningLevel` (from setup / team edit) takes precedence over year.
 */
export function resolveLearningTier(teamData: {
  learningLevel?: string | null;
  yearLevel?: string | null;
  grade?: string | null;
} | null | undefined): LearningTier {
  const level = teamData?.learningLevel;
  if (level === 'upper_primary' || level === 'lower_secondary') {
    return level;
  }

  const year = parseYearNumber(teamData?.yearLevel ?? teamData?.grade);
  if (year === 4 || year === 5 || year === 6) return 'upper_primary';
  if (year === 7 || year === 8 || year === 9) return 'lower_secondary';

  return 'lower_secondary';
}

export function learningTierLabel(tier: LearningTier): string {
  return tier === 'upper_primary' ? 'Primary' : 'Secondary';
}
