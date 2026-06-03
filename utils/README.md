# Utilities

Pure functions: no React, no Firebase, no SQLite, no side effects.

**Subfolders:**

- `calculations/` — experiment-specific math (inputs/outputs only)
- `formatters/` — duration, dates, display labels
- `scoring/` — leaderboard points, sound level conversion, journal normalisation

**Stage 2A (done):**

- `calculations/sound-metering.ts`
- `scoring/leaderboard-scoring.ts`
- `formatters/lab-journal.ts`

Stage 2A–2B modules live here; imports use `@/utils/...` only (compatibility re-exports under `hooks/` removed in Final Cleanup 1).
