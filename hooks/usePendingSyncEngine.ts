import { registerPendingSyncTaskSafely } from '@/services/sync/register-sync-task';
import { processPendingSyncQueue } from '@/services/sync/process-pending-sync';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef } from 'react';

import { auth } from '@/hooks/firebaseConfig';

export { STEMM_PENDING_SYNC_TASK } from '@/services/tasks/sync-task';
export { processPendingSyncQueue } from '@/services/sync/process-pending-sync';
export { getPendingSyncCount } from '@/services/sync/pending-sync-queue';

/**
 * Registers the Task Manager task and retries pending Firestore uploads when the app is foregrounded.
 * Not a notification engine — separate from hooks/useNotificationEngine.ts.
 */
export function usePendingSyncEngine() {
  const setupStarted = useRef(false);
  const lastFlushUid = useRef<string | null>(null);

  useEffect(() => {
    if (setupStarted.current) return;
    setupStarted.current = true;
    void registerPendingSyncTaskSafely();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user?.uid) {
        lastFlushUid.current = null;
        return;
      }
      if (lastFlushUid.current === user.uid) return;
      lastFlushUid.current = user.uid;

      void processPendingSyncQueue().then((summary) => {
        if (__DEV__ && summary.processed > 0) {
          console.log('[PendingSync] Foreground flush:', summary);
        }
      });
    });

    return unsubscribe;
  }, []);
}
