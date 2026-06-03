export const SOUND_BASELINE_CAPTURE_MS = 2000;
export const SOUND_METERING_UPDATE_MS = 100;
export const SOUND_METERING_SMOOTHING_WINDOW = 5;

export type SoundMeasurement = {
  /** Peak estimated level — used for upload/leaderboard (`peakDb`). */
  db: number;
  label: string;
  /** Smoothed average during the action window (display only). */
  avgDb?: number;
  /** Peak increase above the captured room baseline (display only). */
  aboveBaselineDb?: number;
};

export function meteringDbFsToEstimatedLevel(dbfs: number): number {
  const clamped = Math.max(-160, Math.min(0, dbfs));
  const estimated = clamped + 70;
  return Math.round(Math.max(25, Math.min(100, estimated)));
}

export function smoothEstimatedLevels(samples: number[]): number {
  if (!samples.length) return 0;
  const window = samples.slice(-SOUND_METERING_SMOOTHING_WINDOW);
  const sum = window.reduce((total, value) => total + value, 0);
  return Math.round(sum / window.length);
}

export function medianEstimatedLevel(samples: number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return median;
}

export type SoundTeachingRiskSeverity = 'quiet' | 'moderate' | 'lively' | 'loud' | 'veryLoud';

export type SoundTeachingRiskBand = {
  label: string;
  severity: SoundTeachingRiskSeverity;
};

export function getSoundTeachingRiskBand(estimatedLevel: number): SoundTeachingRiskBand {
  if (estimatedLevel < 45) {
    return { label: 'Quiet (approx. teaching band)', severity: 'quiet' };
  }
  if (estimatedLevel < 58) {
    return { label: 'Moderate (approx. teaching band)', severity: 'moderate' };
  }
  if (estimatedLevel < 72) {
    return { label: 'Lively (approx. teaching band)', severity: 'lively' };
  }
  if (estimatedLevel < 85) {
    return { label: 'Very loud (approx. teaching band)', severity: 'loud' };
  }
  return {
    label: 'Extremely loud (approx. — not a certified safety reading)',
    severity: 'veryLoud',
  };
}

export function formatEstimatedLevel(level: number): string {
  return `${level} dB`;
}

export function formatAboveBaseline(delta: number): string {
  return `+${delta} above room baseline`;
}
