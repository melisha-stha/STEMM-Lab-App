/**
 * Firebase initialisation for STEMM-Lab-App-2.
 *
 * Configuration values are read from environment variables instead of being
 * hardcoded in source. Expo SDK 49+ exposes any `EXPO_PUBLIC_*` variable
 * defined in a project-root `.env` file to the client bundle via
 * `process.env` — no extra packages required (do NOT add react-native-dotenv
 * or babel plugins for this).
 *
 * The accompanying `.env.example` documents the variables a developer must
 * provide locally; `.env` itself is git-ignored so real values never enter
 * the repository.
 *
 * Exports:
 *   - `auth` — the shared `Auth` instance (used by hooks/authService.js).
 *   - `db`   — the shared `Firestore` instance (used by hooks/firestore.ts).
 */

import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Guard against duplicate initialisation during Fast Refresh / hot reload.
// `initializeApp` would otherwise throw "Firebase App named '[DEFAULT]'
// already exists" the second time this module is evaluated.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);   // Needed for SCRUM-92 (Data Sync)

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
