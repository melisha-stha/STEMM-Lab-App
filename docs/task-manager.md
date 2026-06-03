# Task Manager — pending cloud sync

STEMM Lab uses **Expo Task Manager** (`expo-task-manager`) for a minimal **background-style sync** path when Firestore upload fails during an activity save.

This is **not** the same as local notifications (`expo-notifications`). Notifications confirm success; they do not upload data.

---

## Task name

| Constant | Value |
|----------|--------|
| `STEMM_PENDING_SYNC_TASK` | `STEMM_PENDING_SYNC_TASK` |

Defined once in `services/tasks/sync-task.ts` via `TaskManager.defineTask`.

Imported at app startup from `app/_layout.tsx` so the task is registered before any screen loads.

---

## What it does

1. **Immediate upload (primary path)** — Unchanged. Activities still call existing `upload*` helpers inside `Promise.all` with `insertTrial` (SQLite).
2. **On upload failure (fallback)** — Parachute and Sound enqueue a pending item in AsyncStorage (`@stemm/pending_sync_queue`) and ensure a local SQLite trial row exists.
3. **Retry** — `processPendingSyncQueue()` replays pending items using the same Firestore helpers (no payload shape changes).
4. **Task callback** — When the OS invokes `STEMM_PENDING_SYNC_TASK`, it runs the same processor and logs a summary.

Foreground retry is wired in `hooks/usePendingSyncEngine.ts` (tab layout) when the user signs in or returns with an active session.

---

## Pending queue shape

Stored in **AsyncStorage** (no SQLite schema change).

| Field | Purpose |
|-------|---------|
| `id` | Unique queue entry |
| `activityKey` | `parachute` \| `sound` (extendable) |
| `createdAt` | ISO timestamp |
| `userId` | Firebase Auth uid when queued |
| `teamId` / `teamName` | Team metadata for logging |
| `payload` | Activity-specific blob passed to existing upload helpers |
| `status` | `pending` \| `synced` \| `failed` |
| `retryCount` | Incremented on failed retry (max 5) |

Successful uploads remove the item from the queue. Items that exceed max retries are marked `failed` and are no longer retried automatically.

---

## Expo Go vs APK / dev build

| Runtime | Behaviour |
|---------|-----------|
| **Expo Go** | Foreground upload and **foreground queue flush** work when the user is signed in. **Scheduled background execution is unreliable or unavailable** — do not demo Task Manager only in Expo Go. |
| **Development build / APK** | Same code path; optional future `expo-background-fetch` can call `STEMM_PENDING_SYNC_TASK` on a schedule (not installed in this project yet). |

Comments in `services/tasks/sync-task.ts` and `services/sync/register-sync-task.ts` document this limitation.

---

## Assignment wording (honest)

You can state that the app:

- Defines a **Task Manager task** (`STEMM_PENDING_SYNC_TASK`) for pending Firestore sync.
- Maintains a **local pending sync queue** when cloud upload fails.
- Retries uploads when the app is open and the user is authenticated (foreground processor).
- Keeps **immediate upload** as the main reliable path in Expo Go.

Do **not** claim that local notifications are Task Manager, or that full OS background scheduling is guaranteed without a dev build.

---

## Related files

| File | Role |
|------|------|
| `services/tasks/sync-task.ts` | `TaskManager.defineTask` |
| `services/sync/pending-sync-queue.ts` | AsyncStorage queue |
| `services/sync/process-pending-sync.ts` | Replay uploads |
| `services/sync/activity-upload-fallback.ts` | Parachute / Sound failure helpers |
| `services/sync/register-sync-task.ts` | Safe registration check |
| `hooks/usePendingSyncEngine.ts` | App wiring |
| `app/parachute.tsx`, `app/sound.tsx` | Failure fallback only |

Other activities can use the same `enqueuePendingSync` pattern without changing Firestore document shapes.
