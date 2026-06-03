/** Display label for a non-empty year level (e.g. `7` → `Year 7`, `Year 8` unchanged). */
export function formatYearLevelLabel(raw: string): string {
  const trimmed = raw.trim();
  return /^year\s+/i.test(trimmed) ? trimmed : `Year ${trimmed}`;
}

/** Form input value: strip leading `Year` prefix for editing. */
export function stripYearLevelPrefix(value: string): string {
  return value.replace(/^Year\s*/i, '');
}
