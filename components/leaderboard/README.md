# Leaderboard components

Reusable leaderboard presentation (Stage 3A).

| Component | Purpose |
|-----------|---------|
| `LeaderboardRow.tsx` | Rank, avatar, team name, year, metric/points lines |
| `OverallChampionCard.tsx` | All-time lab champion summary card |

Scoring and Firestore subscriptions stay in `utils/scoring/leaderboard-scoring.ts` and `app/leaderboard.tsx`.

Empty states and activity tab pills remain in `app/leaderboard.tsx` (screen-specific copy and selection state).
