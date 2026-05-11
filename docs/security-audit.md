# Security Audit — SCRUM-189

**Date:** 2026-05-11
**Auditor:** _(developer to fill in)_
**Sprint:** Sprint 3 (9 May – 25 May 2025)

---

## Scope

A full-tree audit of the `STEMM-Lab-App-2` repository was performed against the
`shreeya` branch (post-merge from `main`, commit `dc8918e`). The audit looked
for:

- Hardcoded Firebase config fields
  (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`,
  `appId`, `measurementId`).
- Any string matching the Google API-key pattern (`AIza[0-9A-Za-z_-]{20,}`).
- Common secret filenames (`firebaseConfig.*`, `firebase.*`, `config.*`).
- Long alphanumeric strings or URLs containing credentials.
- Service-account JSON files, third-party tokens, and `.pem` / `.p12` keys.

Tooling: ripgrep across every tracked file in the workspace.

---

## Findings

### Finding 1 — Hardcoded Firebase Configuration

- **File:** `hooks/firebaseConfig.js`
- **Lines:** 7 (`apiKey`), 8 (`authDomain`), 9 (`projectId`),
  10 (`storageBucket`), 11 (`messagingSenderId`), 12 (`appId`).
- **Severity:** Medium
- **Description:** All six Firebase Web SDK client config fields — including
  a literal `AIza…` Google API key — were committed directly in source.
  Firebase client-side keys are not server secrets, but committing them in a
  public repository allows any third party to identify the project and
  attempt abuse (quota exhaustion, brute force against Firebase Auth, etc.)
  within Firebase's own access controls. Best practice is to keep client
  config in environment variables to avoid accidental disclosure and to make
  rotation easier.
- **Resolution:**
  - All six fields plus a placeholder for `measurementId` moved to a
    project-root `.env` file using Expo's native `EXPO_PUBLIC_*`
    convention (Expo SDK 49+ injects these into `process.env` at bundle
    time — no extra package required).
  - `hooks/firebaseConfig.js` now reads exclusively from `process.env`.
  - `.env` is git-ignored; `.env.example` (empty values) is committed so
    teammates know which variables to populate locally.
  - A `getApps().length === 0` guard was added around `initializeApp` to
    prevent the "Firebase App named '[DEFAULT]' already exists" runtime
    error during Fast Refresh / hot reload.
  - Exported symbols (`auth`, `db`) and their import path
    (`./firebaseConfig`) are unchanged, so no caller (`hooks/authService.js`,
    `hooks/firestore.ts`, `app/(tabs)/index.tsx`, `app/parachute.tsx`)
    needed to be touched.

### Informational matches (not findings)

- `docs/firestore-rules-testing.md` line 27 references the project ID
  `stemm-lab-app-6ec5b` in user-facing instructions. Firebase project IDs are
  inherently public (they appear in every Firebase Console URL and in the
  domain of every Firebase Hosting site), so this is documentation, not a
  secret leak.

---

## Controls Verified

- [x] `.env` listed in `.gitignore` ✅
- [x] `.env.local` listed in `.gitignore` ✅ (alongside the pre-existing
      `.env*.local` wildcard)
- [x] `.env.example` committed with empty values for teammate reference ✅
- [x] Firebase Security Rules enforce ownership-based access
      (see [SCRUM-185 / `firestore.rules`](../firestore.rules) and the
      [testing guide](firestore-rules-testing.md)) ✅
- [x] No other secrets, tokens, or private keys found anywhere in the
      codebase (verified by ripgrep scans for `AIza`, Firebase config field
      names, and common secret filenames) ✅

---

## Residual Risk

Firebase client-side API keys are inherently **semi-public by design** — they
identify the Firebase project but do not grant administrative access. The
primary defence layer is **Firestore Security Rules** (deployed in
SCRUM-185), which guarantee that no document in the `parachute_results`
collection can be created, updated, or deleted without valid authentication
and ownership of the document.

Moving the key out of source nonetheless reduces the blast radius of an
accidental public repository push and is considered industry best practice
for any client-side credential.

The `.env` file lives only on developer machines. If it is ever committed by
accident, the API key should be rotated via the
[Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
page (the rotation invalidates the old key immediately).

---

## Recommendations

1. **Rotate the Firebase API key** if the repository (or any fork) has ever
   been public with the key committed. This conversation's git log shows the
   key was present in source through commits up to `ed45123 firebase setup
   and login/sign up pages` and remained until the SCRUM-189 refactor.
2. **Enable Firebase App Check** in a future sprint to restrict Firebase API
   usage to the genuine app binary (via Play Integrity, App Attest, and
   reCAPTCHA for web).
3. **Restrict the API key in Google Cloud Console** to the application's
   bundle identifier (`com.melisha-stha.stemm-lab-app` on iOS, the package
   name on Android, and the production web origin). This is a one-click
   change in the Credentials page and provides defence in depth.
4. **Add a CI guard** (e.g. a pre-commit hook or a GitHub Action running
   `trufflehog` / `gitleaks`) so any future hardcoded secret is caught
   before it reaches `origin`.

---

## Files changed in this audit

| Path                          | Change                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `hooks/firebaseConfig.js`     | Hardcoded values replaced with `process.env.*`; added hot-reload guard and JSDoc. |
| `.env`                        | Created — real config values, git-ignored.              |
| `.env.example`                | Created — empty placeholders, committed.                |
| `.gitignore`                  | Added explicit `.env` and `.env.local` entries.         |
| `docs/security-audit.md`      | This document.                                          |

No other source files were modified.
