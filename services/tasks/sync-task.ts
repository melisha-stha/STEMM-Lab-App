/**
 * STEMM Lab — Task Manager background-style pending sync.
 *
 * Expo Go may not run this task on a schedule; foreground flush via
 * usePendingSyncEngine is the reliable path. Scheduled execution needs a
 * development build/APK and optional expo-background-fetch (not installed).
 */
import * as TaskManager from 'expo-task-manager';

import { processPendingSyncQueue } from '@/services/sync/process-pending-sync';

export const STEMM_PENDING_SYNC_TASK = 'STEMM_PENDING_SYNC_TASK';

TaskManager.defineTask(STEMM_PENDING_SYNC_TASK, async () => {
  try {
    const summary = await processPendingSyncQueue();
    if (__DEV__) {
      console.log(`[${STEMM_PENDING_SYNC_TASK}] completed`, summary);
    }
    return summary;
  } catch (error) {
    console.error(`[${STEMM_PENDING_SYNC_TASK}] error`, error);
    return { processed: 0, synced: 0, failed: 0, skipped: 0 };
  }
});
