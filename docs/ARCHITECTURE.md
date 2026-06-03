# STEMM Lab Architecture

## Overview

STEMM Lab is a cross-platform **Expo Router / React Native** application for school STEMM programs. Teams sign in, complete hands-on lab activities, sync results to the cloud for leaderboards, and review progress on a map and team profile.

The codebase is organised into clear layers:

| Layer | Location | Role |
|-------|----------|------|
| **Routes & screens** | `app/` | File-based routes (Expo Router). Each file under `app/` maps to a URL path. |
| **UI components** | `components/` | Reusable presentation (buttons, cards, inputs, activity backgrounds, shared sections). |
| **Hooks** | `hooks/` | React hooks (`useThemeColor`, `usePixelFont`, …) and I/O modules (Firestore, SQLite, storage) moving gradually into `services/`. |
| **Utilities** | `utils/` | Pure helpers (Stage 2A): `calculations/sound-metering`, `scoring/leaderboard-scoring`, `formatters/lab-journal`. |
| **Design tokens** | `constants/` | Spacing, typography, colours, pixel brand tokens (`design.ts`, `theme.ts`, `pixel-brand.ts`). |
| **App-wide state** | `contexts/` | Theme preference and pixel font loading providers. |
| **Static assets** | `assets/` | Images, fonts, icons used by activities and onboarding. |
| **Documentation** | `docs/` | Architecture, security audit, Firestore testing, build guides. |

Path alias `@/` maps to the project root (see `tsconfig.json`).

Target folders (`utils/`, `services/`, `components/activity/`, etc.) are **scaffolded** for staged refactors. Existing code remains in place until each stage is tested.

---

## Current Route Structure

Expo Router discovers routes from filenames under `app/`. The root stack is defined in `app/_layout.tsx`.

### Onboarding and authentication

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/index.tsx` | Redirects to welcome screen |
| `/welcome-screen` | `app/welcome-screen.tsx` | Landing, sign in / sign up entry |
| `/login` | `app/login.tsx` | Email/password sign in |
| `/signup` | `app/signup.tsx` | Account creation |
| `/forgot-password` | `app/forgot-password.tsx` | Password reset |
| `/setup-level` | `app/setup-level.tsx` | Learning level selection |
| `/setup-year` | `app/setup-year.tsx` | Year level |
| `/setup-team` | `app/setup-team.tsx` | Team name, members, avatar |

Post-auth routing: `hooks/app-routing.ts` (`resolveAppRoute`, `resolvePostLoginRoute`).

### Tab routes (`app/(tabs)/`)

| Tab route | File | Purpose |
|-----------|------|---------|
| `/(tabs)` / `/(tabs)/index` | `app/(tabs)/index.tsx` | Home — activity grid, mission progress, stats |
| `/(tabs)/leaderboard` | `app/(tabs)/leaderboard.tsx` | Re-exports `app/leaderboard.tsx` |
| `/(tabs)/map` | `app/(tabs)/map.tsx` | Re-exports `app/map.tsx` |
| `/(tabs)/team` | `app/(tabs)/team.tsx` | Team profile, lab journal, device battery |

### Lab activity routes (fullscreen stack)

| Route | File | Activity |
|-------|------|----------|
| `/parachute` | `app/parachute.tsx` | Parachute Drop |
| `/sound` | `app/sound.tsx` | Sound Pollution Hunter |
| `/earthquake` | `app/earthquake.tsx` | Earthquake Structure |
| `/reaction` | `app/reaction.tsx` | Reaction Board |
| `/breathing` | `app/breathing.tsx` | Breathing Pace Trainer |
| `/handfan` | `app/handfan.tsx` | Hand Fan Challenge |
| `/performance` | `app/performance.tsx` | Human Performance Lab |

### Result and reflection routes

| Route | File |
|-------|------|
| `/parachute-results` | `app/parachute-results.tsx` |
| `/sound-results` | `app/sound-results.tsx` |
| `/earthquake-results` | `app/earthquake-results.tsx` |
| `/reaction-results` | `app/reaction-results.tsx` |
| `/breathing-results` | `app/breathing-results.tsx` |
| `/handfan-results` | `app/handfan-results.tsx` |
| `/performance-results` | `app/performance-results.tsx` |

Reflections are saved locally via `hooks/storage.js` (`save*Results` / `get*Results`). Upload to Firestore happens from the activity screen before navigating to results.

### Other routes

| Route | File | Purpose |
|-------|------|---------|
| `/map` | `app/map.tsx` | Team-filtered drop-site map (Google Maps) |
| `/leaderboard` | `app/leaderboard.tsx` | Per-activity top 10 + all-time champion |
| `/how-it-works` | `app/how-it-works.tsx` | In-app guide |
| `/modal` | `app/modal.tsx` | Template modal (legacy) |

**Note:** Filenames under `app/` must not be renamed without updating Expo Router and all `router.push` / `href` references.

---

## Data Layer

### Firebase Auth

- Configuration: `hooks/firebaseConfig.js` (reads `EXPO_PUBLIC_*` from `.env`).
- Auth API: `hooks/authService.js` (sign up, login, password reset).
- Persistence: React Native AsyncStorage via Firebase Auth.

### Cloud Firestore

- **Team profiles:** `teamProfiles/{userId}` — onboarding metadata (name, members, grade, year, avatar).
- **Activity results:** Collections such as `parachute_results`, `soundResults`, `earthquakeResults`, `reactionResults`, `breathingResults`, `handfanResults`, `performanceResults`.
- **Leaderboards:** Live queries with `orderBy` + `limit`; client-side dedupe for overall champion scoring (`utils/scoring/leaderboard-scoring.ts`).
- **Map (cloud pins):** User-scoped queries merged with local SQLite trials; team filtering on device.

Upload and subscription logic: `hooks/firestore.ts`. Security rules: `firestore.rules`.

### SQLite (local)

- Database: `stemmlab.db`, table `trials` — team name, activity, metric time, optional video URI, GPS, timestamp.
- API: `hooks/database.ts` (`initDatabase`, `insertTrial`, `getTrials`, team filtering helpers).
- Used for Home stats, map pins, and offline history on device.

### AsyncStorage (local)

- Team profile cache (device + optional UID scope).
- Per-activity reflection histories (`@parachute_results`, etc.) — `hooks/storage.js`.
- Theme preference (`@app_color_scheme`).

### Device capabilities (by activity)

| Capability | Used in |
|------------|---------|
| **Accelerometer** | Breathing, Human Performance |
| **Gyroscope + Accelerometer** | Earthquake (stability score during shaker test) |
| **Microphone** (`expo-av` metering) | Sound |
| **Camera / video** (`expo-av`, image picker) | Parachute |
| **Location** | Upload flows, map, battery/location helper |
| **Notifications** | Post-sync alerts (`hooks/notifications.ts`) |

---

## Component Layer

### Current: `components/ui/`

Shared pixel/pastel UI used across the app:

- Actions: `primary-button`, `input`, `pixel-button`, `pixel-choice-button`
- Layout: `section-card`, `screen-back-button`, `info-row`, `badge-pill`
- Activity chrome: `activity-color-panel`, `activity-card`, per-activity `*-screen-background`
- Features: `experiment-challenge-timer`, `video-scrubber`, `lab-journal-section`, `attempt-row`, `theme-mode-toggle`
- Auth/setup: `auth-screen-background`, `team-setup-screen-background`, `learning-level-card` (where used)

### Scaffolded (future extractions)

| Folder | Intended contents |
|--------|-------------------|
| `components/activity/` | Shared activity UI: `ActivityStepPanel`, `ActivityScreenTabs`, `EquipmentChecklist`, overview hero blocks |
| `components/leaderboard/` | `LeaderboardRow`, `AllTimeChampionCard`, empty states (extracted from `app/leaderboard.tsx`) |
| `components/team/` | Team profile sections beyond what stays in `app/(tabs)/team.tsx` |
| `components/layout/` | Cross-screen layout helpers (optional grouping of backgrounds, scroll insets wrappers) |

Extracting these components is **Stage 3** — presentation only, no change to experiment logic.

---

## Utility and Service Target Structure

Today, many non-UI modules live under `hooks/` for historical reasons. The target separation:

### `utils/` — pure functions (no React, no I/O)

| Subfolder | Examples (current or planned) |
|-----------|-------------------------------|
| `utils/calculations/` | `sound-metering.ts`; parachute/earthquake helpers (planned) |
| `utils/formatters/` | `lab-journal.ts`; duration/date labels (planned) |
| `utils/scoring/` | `leaderboard-scoring.ts` |

### `services/` — I/O and external systems

| Subfolder | Examples (current location) |
|-----------|----------------------------|
| `services/firebase/` | `firebaseConfig.js`, `firestore.ts` uploads/subscriptions |
| `services/database/` | `database.ts` (SQLite) |
| `services/storage/` | `storage.js` (AsyncStorage team + reflections) |
| `services/notifications/` | `notifications.ts`, notification engine wiring |

### `hooks/` — React hooks only (target)

Keep: `useThemeColor`, `useColorScheme`, `usePixelFont`, `useDeviceBattery`, `useScreenScrollInsets`, `useNotificationEngine`, etc.

**Stage 2A** moved sound metering, leaderboard scoring, and lab journal loaders into `utils/`; `hooks/` re-exports remain. **Stage 2B+** and **Stage 4** (services) continue with re-exports until imports are updated.

---

## Why Some Activity Screens Are Still Large

Several lab screens are **900–1,900 lines** in a single file (`app/parachute.tsx`, `app/reaction.tsx`, `app/sound.tsx`, etc.). This is intentional stability before assignment submission:

- **Parachute** — Video capture, frame markers, drop-time calculations, and upload payload assembly are tightly coupled to UI state.
- **Reaction** — Multi-phase game state machine, timers, and attempt recording.
- **Breathing** — Accelerometer sampling, session flow, and BPM derivation.
- **Earthquake** — Live gyroscope/accelerometer subscriptions, shaker test, and stability scoring.
- **Sound** — Microphone baseline capture, metering conversion, and measurement list state.

Each activity also duplicates similar **overview / experiment / write-up / discussion** tab UI and local `StepPanel` helpers. Those are safer to extract later than core experiment state machines.

Pure calculations and repeated UI are planned for **controlled extraction** in Stages 2–3 without changing Firebase payloads, SQLite schema, or route names.

---

## Refactor Safety Rules

Before and after every cleanup stage:

1. **Do not rename** `app/` route files without updating Expo Router and all navigation calls.
2. **Do not change** Firestore document field names or upload payloads without end-to-end upload and leaderboard tests.
3. **Do not change** SQLite schema or `insertTrial` contract unless explicitly required and migrated.
4. **Do not refactor** reaction, parachute, or breathing state machines in large steps before submission.
5. **Do not change** leaderboard `orderBy` fields, overall points rules, or map team-filtering logic without manual verification.
6. **Preserve** pixel/pastel theme tokens and existing visual behaviour when moving UI files.
7. **After each stage**, run `npx tsc --noEmit` and smoke-test: auth, one activity upload, leaderboard, map, team profile + lab journal.

Secrets stay in `.env` (`EXPO_PUBLIC_*`); never commit `.env` (see `.env.example` and `docs/security-audit.md`).

---

## Future Cleanup Checklist

| Stage | Scope | Risk |
|-------|--------|------|
| **Stage 1** | Architecture docs + folder scaffolding (this document) | Very low |
| **Stage 2A** | Move pure utilities to `utils/` (`sound-metering`, `leaderboard-scoring`, `lab-journal`) — **done**; `hooks/*` re-exports retained | Low |
| **Stage 2B** | Further formatters (e.g. shared `formatDuration`) with re-exports | Low |
| **Stage 3** | Extract repeated UI (`StepPanel`, tab bar, equipment checklist, leaderboard rows) | Low–medium |
| **Stage 4** | Optional split of `firestore.ts`, `storage.js` into `services/` | Medium |
| **Stage 5** | Remove confirmed dead files (template components, unused routes) after reference search | Low |

Stage 1 does **not** move application code. The working app behaviour is unchanged.

---

## Related documentation

- [README.md](../README.md) — setup, features, environment variables
- [security-audit.md](./security-audit.md) — secrets and Firebase config practices
- [firestore-rules-testing.md](./firestore-rules-testing.md) — Firestore security rules
- [apk-build-guide.md](./apk-build-guide.md) — production builds
