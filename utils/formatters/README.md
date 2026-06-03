# Formatters

Pure display helpers (no React, no I/O).

## Files (Stage 2A + 2B)

| File | Functions |
|------|-----------|
| `duration.ts` | `formatDuration`, `formatCentisecondsTimer`, `formatCountdownSeconds`, `formatChallengeClock` |
| `date.ts` | `formatLocaleDateTime`, `formatLocaleDateTimeFromString` |
| `team.ts` | `formatYearLevelLabel`, `stripYearLevelPrefix` |
| `metrics.ts` | `shortDesignLabel` |
| `lab-journal.ts` | `loadLabJournalEntries`, `formatLabJournalSavedAt`, team filter helpers |

Sound dB display strings remain in `utils/calculations/sound-metering.ts` (`formatEstimatedLevel`, `formatAboveBaseline`).

`components/ui/experiment-challenge-timer.tsx` re-exports `formatChallengeClock` from `duration.ts`.
