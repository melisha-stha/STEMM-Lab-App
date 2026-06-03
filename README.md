# STEMM Lab App

A cross-platform mobile app for school **STEMM** (Science, Technology, Engineering, Mathematics, Medicine/Health) programs. Teams create an account, complete onboarding, run hands-on lab activities, save results locally, sync leaderboards to Firebase, and review progress on a GPS map.

Built with **Expo SDK 54**, **React Native**, **Expo Router**, **Firebase**, and **SQLite**. The UI uses a pixel-art style (Press Start 2P on Android) with light/dark theme support.

---

## Table of contents

- [Features](#features)
- [Lab activities](#lab-activities)
- [User flows](#user-flows)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Project Structure and Architecture](#project-structure-and-architecture)
- [Data & sync](#data--sync)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Google Maps](#google-maps)
- [Running the app](#running-the-app)
- [Building for production](#building-for-production)
- [Expo Go limitations](#expo-go-limitations)
- [Scripts](#scripts)
- [Additional documentation](#additional-documentation)
- [License & context](#license--context)

---

## Features

### Team accounts & onboarding

- **Sign up / sign in** with Firebase Authentication (email + password).
- **Password reset** via Firebase email flow.
- **Onboarding**: learning level (primary / secondary) → year level → team name & member first names.
- Team profile is stored **on device** (AsyncStorage) and **in the cloud** (`teamProfiles/{uid}` in Firestore) so the same account can restore setup on a new device after login.

### Main app (tab navigation)

| Tab | Purpose |
|-----|---------|
| **Home** | Activity grid, mission progress (7 labs), team snapshot, quick stats |
| **Ranks** | Global leaderboards per activity (Firestore-backed) |
| **Map** | Google Maps view of GPS-tagged trial locations |
| **Team** | Avatar, profile edit, stats, sign out / reset team setup |

### Experience

- **Light / dark mode** with in-app toggle (preference persisted locally).
- **Pixel UI** components and optional Press Start 2P font (Android loads via `PixelFontProvider`).
- **Haptic feedback** on tab presses.
- **Local notifications** after some lab syncs (requires a development build on Android; see [Expo Go limitations](#expo-go-limitations)).

### Account actions (Team tab)

| Action | Behavior |
|--------|----------|
| **Sign out** | Ends Firebase session, clears local team cache, returns to welcome. Cloud team profile is **kept** — signing in again restores the same team. |
| **Reset team setup** | Clears local team + deletes cloud `teamProfiles` doc (when signed in), blocks cloud restore until setup finishes, routes to **setup-level** while staying signed in. Device lab trials (SQLite) are **not** deleted. |

---

## Lab activities

Seven fullscreen lab workspaces. Each records trials to SQLite and can sync results to Firestore for leaderboards.

| Activity | Route | Focus |
|----------|-------|--------|
| Parachute Drop | `/parachute` | Engineering · Physics |
| Sound Pollution Hunter | `/sound` | Health · Physics |
| Earthquake Structure | `/earthquake` | Engineering · Earth Science |
| Reaction Board | `/reaction` | Health · Neuroscience |
| Breathing Pace Trainer | `/breathing` | Health · Biology |
| Hand Fan Challenge | `/handfan` | Engineering · Physics |
| Human Performance Lab | `/performance` | Health · Biology |

Most activities have dedicated **results** screens (e.g. `/parachute-results`, `/breathing-results`) for reflection and submission.

---

## User flows

```text
Welcome → Sign up / Sign in
              ↓
        (new user) setup-level → setup-year → setup-team → (tabs)
        (returning) login → restore cloud profile if needed → (tabs) or setup
```

- **Entry**: `app/index.tsx` redirects to `/welcome-screen`.
- **Post-login routing**: `hooks/app-routing.ts` (`resolvePostLoginRoute`, `resolveAppRoute`).
- **Auth guard on Home**: `onAuthStateChanged` redirects unauthenticated users or users without a team profile.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Expo ~54, React 19, React Native 0.81 |
| Navigation | Expo Router 6 (file-based), React Navigation 7 |
| Auth | Firebase Auth 12 (AsyncStorage persistence) |
| Cloud DB | Cloud Firestore |
| Local DB | expo-sqlite (`stemmlab.db`, `trials` table) |
| Local prefs | `@react-native-async-storage/async-storage` |
| Maps | `react-native-maps` + **Google Maps** (`PROVIDER_GOOGLE`) |
| Media / sensors | expo-av, expo-location, expo-sensors, expo-image-picker |
| Ads | react-native-google-mobile-ads (banner) |
| Fonts | @expo-google-fonts/press-start-2p |

---

## Project structure

```text
app/                    # Expo Router screens
  (tabs)/               # Main shell: Home, Ranks, Map, Team
  welcome-screen.tsx    # Landing
  login.tsx, signup.tsx, forgot-password.tsx
  setup-level.tsx, setup-year.tsx, setup-team.tsx
  parachute.tsx, sound.tsx, …   # Lab workspaces
  *-results.tsx         # Activity result / reflection screens
  map.tsx               # Drop site map (also re-exported in tabs)
  _layout.tsx           # Root stack, fonts, SQLite init, notifications

components/             # UI (pixel buttons, cards, inputs, ads, …)
constants/              # theme.ts, design tokens, pixel brand
contexts/               # Theme preference, pixel font loading
hooks/
  firebaseConfig.js     # Firebase app + auth (RN persistence)
  authService.js        # signUp, login, password reset
  storage.js            # Team profile AsyncStorage
  team-profile.ts       # Firestore teamProfiles + reset/sign-out helpers
  database.ts           # SQLite trials
  firestore.ts          # Leaderboard sync & queries
  app-routing.ts        # Post-auth route resolution
  notifications.ts      # Safe expo-notifications wrapper (Expo Go aware)

docs/                   # APK build, Firestore rules testing, security audit
assets/                 # Images, fonts, icons
firestore.rules         # Security rules for result collections + teamProfiles
```

Path alias `@/` maps to the project root (see `tsconfig.json`).

---

## Project Structure and Architecture

STEMM Lab uses **Expo Router** file-based routing under `app/`, shared UI under `components/`, and data access modules under `hooks/` (with `utils/` and `services/` scaffolded for gradual cleanup). Design tokens live in `constants/`; theme and font providers in `contexts/`; images and fonts in `assets/`. Full layer diagrams, route tables, data stores, and staged refactor rules are documented in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

```text
app/                      # Screens and routes
components/
  ui/                     # Shared buttons, cards, inputs (existing)
  activity/               # Future shared activity UI (scaffold)
  leaderboard/            # Future leaderboard UI (scaffold)
  layout/                 # Future layout helpers (scaffold)
  team/                   # Future team profile UI (scaffold)
hooks/                    # React hooks + current Firebase/SQLite/storage modules
constants/                # Theme and design tokens
contexts/                 # Theme preference, pixel font
assets/                   # Images, fonts
docs/                     # Architecture, security, build guides
utils/                    # Pure formatters, calculations, scoring (scaffold)
services/                 # Firebase, database, storage, notifications (scaffold)
```

Stage 1 adds documentation and empty target folders only—**no application code has been moved** yet.

---

## Data & sync

### Local (device)

- **Team profile** — AsyncStorage keys scoped by Firebase UID when signed in (`@team_info:<uid>`).
- **Trials** — SQLite `trials`: `teamName`, `activity`, `time`, `videoUri`, `latitude`, `longitude`, `createdAt`.
- **Theme** — `@app_color_scheme` (`light` | `dark`).
- **Per-activity result history** — optional AsyncStorage keys (e.g. `@parachute_results`).

### Cloud (Firestore)

- **`teamProfiles/{userId}`** — onboarding team metadata (name, members, grade, year, learning level, avatar).
- **Result collections** — per-activity docs with `userId` for ownership; global read for leaderboards where rules allow (see `firestore.rules`).

Leaderboard and sync logic live in `hooks/firestore.ts`. Local SQLite remains the source of truth for map pins and on-device history until a lab explicitly syncs to Firestore.

---

## Getting started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm**
- [Expo Go](https://expo.dev/go) on a physical device, or Android Studio / Xcode simulators
- A **Firebase** project with Email/Password auth and Firestore enabled
- **Google Maps API** keys for iOS and Android (Maps tab)

### Install

```bash
git clone <repository-url>
cd STEMM-Lab-App-2
npm install
```

---

## Environment variables

Copy the example file and fill in your Firebase web app config:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | App ID |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics (optional) |

Expo exposes `EXPO_PUBLIC_*` variables to the client bundle. Do **not** commit `.env` (it should be gitignored).

Deploy `firestore.rules` to your Firebase project before testing cloud sync in production-like builds.

---

## Google Maps

Replace placeholders in `app.json`:

- **iOS**: `expo.ios.config.googleMapsApiKey`
- **Android**: `expo.android.config.googleMaps.apiKey`

Enable the **Maps SDK for Android** and **Maps SDK for iOS** in Google Cloud Console and restrict keys appropriately.

The map screen uses `PROVIDER_GOOGLE` on native platforms. On **web**, the map shows a fallback message (maps are mobile-only).

---

## Running the app

```bash
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go.

Platform-specific shortcuts:

```bash
npm run ios
npm run android
npm run web
```

Clear Metro cache if needed:

```bash
npx expo start -c
```

Lint:

```bash
npm run lint
```

---

## Building for production

For installable Android APKs and full native capabilities (push notifications on Android, ads, etc.), use **EAS Build** rather than Expo Go.

See **[docs/apk-build-guide.md](docs/apk-build-guide.md)** for:

- `eas build -p android --profile preview`
- Firebase / AdMob env setup in `eas.json` or EAS Secrets
- Installing the APK on devices

---

## Expo Go limitations

When developing in **Expo Go**:

| Feature | Notes |
|---------|--------|
| **Android push / remote notifications** | Not supported in Expo Go (SDK 53+). The app loads `expo-notifications` only in dev/production builds via `hooks/notifications.ts`. |
| **expo-av** | Deprecated in SDK 54; migration to `expo-audio` / `expo-video` planned. |
| **Ads** | May behave differently than in a standalone build. |

Firebase Auth warns in console until AsyncStorage persistence is configured — this project uses `initializeAuth` + `getReactNativePersistence` in `hooks/firebaseConfig.js`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Open iOS simulator |
| `npm run android` | Open Android emulator |
| `npm run web` | Run web build |
| `npm run lint` | Run ESLint (expo config) |
| `npm run reset-project` | **Starter utility only** — moves `app/` to `app-example/` (not for normal STEMM Lab development) |

---

## Additional documentation

| Document | Contents |
|----------|----------|
| [docs/apk-build-guide.md](docs/apk-build-guide.md) | EAS Android APK builds |
| [docs/firestore-rules-testing.md](docs/firestore-rules-testing.md) | Testing Firestore security rules |
| [docs/security-audit.md](docs/security-audit.md) | Security review notes |

---

## License & context

This app is intended for **school science programs** (team-based labs, teacher-led deployment). Package identifiers:

- **iOS**: `com.stemmlab.stemmlabapp`
- **Android**: `com.stemmlab.stemmlabapp`

For questions about Firebase rules, leaderboard data, or classroom rollout, refer to the `docs/` folder and your project’s Firebase console.

---

## Learn more (Expo)

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Firebase for React Native](https://firebase.google.com/docs/web/setup)
