# Leaderboard components

Reusable leaderboard presentation pieces.

**Planned contents (Stage 3):**

- Leaderboard row (rank, avatar, team name, metric)
- All-time lab champion card
- Empty and error states

**Current location:** `app/leaderboard.tsx` (UI); scoring in `utils/scoring/leaderboard-scoring.ts`.

Extracting UI here must **not** change Firestore queries, ranking points, or deduplication rules without explicit testing.
