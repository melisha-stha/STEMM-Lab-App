/** Elapsed challenge time as `m:ss` (seconds rounded from ms). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Live timer as `ss.cc` (seconds and centiseconds within one minute). */
export function formatCentisecondsTimer(ms: number): string {
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

/** Countdown label, e.g. `3s` (seconds rounded up from ms). */
export function formatCountdownSeconds(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${seconds}s`;
}

/** 25-minute challenge clock as `MM:SS` (seconds rounded up from ms). */
export function formatChallengeClock(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
