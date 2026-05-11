# Firestore Security Rules — Testing Guide

This document describes how to verify the Firestore security rules defined in
[`firestore.rules`](../firestore.rules) for STEMM-Lab-App-2.

The rules enforce a hybrid read-public / write-private model:

- **Authenticated** users may **read** any document in `parachute_results`
  (required by the global leaderboard query in
  [`hooks/firestore.ts`](../hooks/firestore.ts) → `subscribeToLeaderboard`).
- **Authenticated** users may **create** documents only when they stamp their
  own `uid` as the `userId` field.
- **Authenticated** users may **update** or **delete** only documents they
  already own (`resource.data.userId == request.auth.uid`).
- **Unauthenticated** requests are denied everywhere.

---

## 1. Where to run the tests

All tests below are designed to run inside the **Firestore Rules Playground**
bundled with the Firebase Console.

### Open the Rules Playground

1. Sign in to the [Firebase Console](https://console.firebase.google.com/).
2. Pick the **`stemm-lab-app-6ec5b`** project (the same `projectId` used by
   `hooks/firebaseConfig.js`).
3. In the left sidebar, click **Build → Firestore Database**.
4. Switch to the **Rules** tab at the top of the Firestore page.
5. Click **Rules Playground** (top-right of the rules editor).

> The Playground is a fully simulated environment — running tests here will
> **not** read, write, or modify any real production data.

---

## 2. Prerequisite — deploy the rules first

Before testing the live rules, deploy them so the Playground evaluates the
latest version:

```bash
# From the project root
firebase deploy --only firestore:rules
```

Alternatively, paste the contents of `firestore.rules` into the Rules editor
in the console and click **Publish**.

---

## 3. Test scenarios

For each scenario, configure the Playground using the listed inputs, click
**Run**, and confirm the expected banner (green “Allow” or red “Deny”).

> **Tip:** screenshot each completed run for the deployment report. The
> banner colour (green vs red) at the top of the Playground panel is the
> single most important visual cue.

---

### Test A — Owner mutates own doc (should PASS ✅)

The owner updates a document they created.

| Playground field   | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Simulation type**| `update` (also try `delete` for full coverage)                  |
| **Location**       | `/parachute_results/test-doc-1`                                 |
| **Authenticated**  | ✅ On                                                           |
| **Provider**       | `password` (any provider works)                                 |
| **Firebase UID**   | `test-user-123`                                                 |
| **Document data**  | `{ "userId": "test-user-123", "bestTime": 3.5 }`                |

**Expected result:** green **Allow** banner.

Reasoning: `isOwner(resource.data.userId)` evaluates
`request.auth.uid == "test-user-123"` → `true`.

---

### Test B — Wrong UID tries to update (should FAIL ❌)

A different authenticated user tries to mutate a document they do not own.

| Playground field   | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Simulation type**| `update` (also try `delete`)                                    |
| **Location**       | `/parachute_results/test-doc-1`                                 |
| **Authenticated**  | ✅ On                                                           |
| **Provider**       | `password`                                                      |
| **Firebase UID**   | `attacker-uid-456`                                              |
| **Document data**  | `{ "userId": "test-user-123", "bestTime": 3.5 }`                |

**Expected result:** red **Deny** banner.

Reasoning: `isOwner` returns `false` because `"attacker-uid-456" != "test-user-123"`.

---

### Test C — Unauthenticated (should FAIL ❌)

An anonymous client attempts to read any document.

| Playground field   | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Simulation type**| `get`                                                           |
| **Location**       | `/parachute_results/test-doc-1`                                 |
| **Authenticated**  | ❌ Off                                                          |
| **Document data**  | `{ "userId": "test-user-123", "bestTime": 3.5 }`                |

**Expected result:** red **Deny** banner.

Reasoning: `request.auth` is `null`, so `isOwner` short-circuits to `false`.

---

### Test D (optional) — Create with mismatched `userId` (should FAIL ❌)

This exercises the dedicated `create` rule and confirms that a user cannot
forge ownership at write time.

| Playground field   | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Simulation type**| `create`                                                        |
| **Location**       | `/parachute_results/new-doc-2`                                  |
| **Authenticated**  | ✅ On                                                           |
| **Firebase UID**   | `attacker-uid-456`                                              |
| **Document data**  | `{ "userId": "test-user-123", "bestTime": 4.2 }`                |

**Expected result:** red **Deny** banner.

Reasoning: `request.resource.data.userId == request.auth.uid` is
`"test-user-123" == "attacker-uid-456"` → `false`.

---

### Test E — Leaderboard read + cross-user delete

This test covers the read-public / write-private split: any signed-in user
may read other teams' results (for the global leaderboard), but **only the
owner** may delete a document.

#### Test E.1 — Signed-in user reads another team's doc (should PASS ✅)

Simulates the `subscribeToLeaderboard()` query in
[`hooks/firestore.ts`](../hooks/firestore.ts), which fetches the top results
regardless of ownership.

| Playground field   | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Simulation type**| `get`                                                           |
| **Location**       | `/parachute_results/test-doc-1`                                 |
| **Authenticated**  | ✅ On                                                           |
| **Provider**       | `password`                                                      |
| **Firebase UID**   | `viewer-uid-789`                                                |
| **Document data**  | `{ "userId": "test-user-123", "bestTime": 3.5 }`                |

**Expected result:** green **Allow** banner.

Reasoning: the `read` rule is `request.auth != null`, which is `true` for any
signed-in user — ownership is not required to read.

#### Test E.2 — Signed-in user tries to delete someone else's doc (should FAIL ❌)

Confirms the read-public / write-private split: the same `viewer-uid-789`
that can read the doc cannot remove it.

| Playground field   | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Simulation type**| `delete`                                                        |
| **Location**       | `/parachute_results/test-doc-1`                                 |
| **Authenticated**  | ✅ On                                                           |
| **Provider**       | `password`                                                      |
| **Firebase UID**   | `viewer-uid-789`                                                |
| **Document data**  | `{ "userId": "test-user-123", "bestTime": 3.5 }`                |

**Expected result:** red **Deny** banner.

Reasoning: `delete` is gated by `isOwner(resource.data.userId)`, which
evaluates `"viewer-uid-789" == "test-user-123"` → `false`.

---

## 4. Screenshots for the deployment report

Capture each of the following and label them clearly:

1. **`test-A-allow.png`** — Playground for Test A showing the **green Allow
   banner** at the top of the right-hand result panel, with the simulation
   inputs visible on the left.
2. **`test-B-deny.png`** — Playground for Test B showing the **red Deny
   banner**, with the mismatched UID clearly visible.
3. **`test-C-deny.png`** — Playground for Test C showing the **red Deny
   banner**, with the “Authenticated” toggle in the off position.
4. _(optional)_ **`test-D-deny.png`** — Playground for Test D showing
   the **red Deny banner** for the impersonation attempt.
5. **`test-E1-allow.png`** — Playground for Test E.1 showing the **green
   Allow banner** for a cross-user leaderboard read.
6. **`test-E2-deny.png`** — Playground for Test E.2 showing the **red Deny
   banner** for a cross-user delete attempt.

In each screenshot, make sure both panels are visible:

- **Left panel:** simulation configuration (location, auth state, UID,
  document data).
- **Right panel:** the result banner plus the “Match → allow” trace
  highlighting which rule fired.

---

## 5. Local automated testing (optional)

For richer coverage you can run the Firebase emulator with
[`@firebase/rules-unit-testing`](https://firebase.google.com/docs/rules/unit-tests):

```bash
firebase emulators:start --only firestore
```

Then write Jest specs that call `assertSucceeds(...)` / `assertFails(...)`
against the same scenarios. This is out of scope for the current sprint but
is the recommended next step once the rules are stable.

---

## 6. What to do if a test fails

- **Test A denies** → double-check that `isOwner` reads `resource.data.userId`
  (not `request.resource.data.userId`) for `update`/`delete`.
- **Test B allows** → the document's `userId` field is missing or the rule is
  reading the wrong field; inspect the document in the Playground.
- **Test C allows** → the wildcard catch-all (`match /{document=**}`) is
  missing or above a more permissive rule; rules are evaluated by the most
  specific match and OR-combined within a match, so order does not normally
  matter, but stray `allow read, write: if true` lines will break the model.
- **Test E.1 denies** → the `allow read: if request.auth != null` rule is
  missing or has been narrowed to `isOwner(...)`; the leaderboard query
  needs unrestricted read access for signed-in users.
- **Test E.2 allows** → `update` or `delete` is being granted by the broader
  `read` rule; confirm `update, delete` is on its own line gated by
  `isOwner(resource.data.userId)`.
