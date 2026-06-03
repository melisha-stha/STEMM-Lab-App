/** Locale date/time from epoch ms; null when missing or invalid. */
export function formatLocaleDateTime(timestampMs: number): string | null {
  if (!timestampMs || !Number.isFinite(timestampMs)) return null;
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

/** Locale date/time from ISO/string; empty string when missing or invalid. */
export function formatLocaleDateTimeFromString(createdAt: string): string {
  if (!createdAt) return '';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
}
