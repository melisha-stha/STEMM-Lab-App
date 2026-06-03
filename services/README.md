# Services

I/O boundaries: Firebase, SQLite, AsyncStorage, notifications, auth.

This folder separates **data access** from React hooks and screen UI.

**Current location:** Most modules still live under `hooks/` (`firestore.ts`, `database.ts`, `storage.js`, `firebaseConfig.js`, `authService.js`, `notifications.ts`, `team-profile.ts`).

**Stage 4** may split large files (especially `firestore.ts`) into submodules here. Upload payload shapes and collection names must not change without full regression testing.
