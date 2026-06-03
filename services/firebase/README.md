# Firebase services

Firebase app initialisation, authentication helpers, Firestore uploads, and realtime subscriptions.

**Current files (in `hooks/`):**

- `firebaseConfig.js` — app, auth, Firestore instances
- `authService.js` — sign up, login, reset password
- `firestore.ts` — activity uploads, leaderboard listeners, map location subscriptions
- `team-profile.ts` — `teamProfiles` documents

**Constraints:** Do not change document field names, security rule assumptions, or `orderBy` fields used by leaderboards without coordinated testing.
