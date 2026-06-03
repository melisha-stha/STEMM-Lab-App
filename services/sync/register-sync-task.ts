import * as TaskManager from 'expo-task-manager';

import { STEMM_PENDING_SYNC_TASK } from '@/services/tasks/sync-task';

export type PendingSyncRegistrationInfo = {
  taskName: string;
  taskDefined: boolean;
  /** OS-scheduled background runs need dev build + expo-background-fetch. */
  backgroundScheduled: boolean;
  note: string;
};

/**
 * Verifies Task Manager registration. Does not install or require expo-background-fetch.
 */
export async function registerPendingSyncTaskSafely(): Promise<PendingSyncRegistrationInfo> {
  const taskDefined = TaskManager.isTaskDefined(STEMM_PENDING_SYNC_TASK);

  const info: PendingSyncRegistrationInfo = {
    taskName: STEMM_PENDING_SYNC_TASK,
    taskDefined,
    backgroundScheduled: false,
    note:
      'Task is defined for Work Manager / Task Manager. Foreground upload remains primary; ' +
      'pending queue retries when the app is open. Expo Go may not run scheduled background work — test on APK/dev build.',
  };

  if (__DEV__) {
    console.log('[PendingSync] Registration:', info);
  }

  return info;
}
