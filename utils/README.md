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

Legacy `hooks/` paths re-export these modules. Further formatters (e.g. shared `formatDuration`) are **Stage 2B**.
