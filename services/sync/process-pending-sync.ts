import { auth } from '@/hooks/firebaseConfig';
import { uploadParachuteResult, uploadSoundResult } from '@/hooks/firestore';

import {
  getPendingSyncItems,
  markPendingSyncFailed,
  markPendingSyncSynced,
  type ParachutePendingPayload,
  type PendingSyncItem,
  type SoundPendingPayload,
} from './pending-sync-queue';

export const PENDING_SYNC_MAX_RETRIES = 5;

export type PendingSyncProcessResult = {
  processed: number;
  synced: number;
  failed: number;
  skipped: number;
};

async function uploadPendingItem(item: PendingSyncItem): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId || userId !== item.userId) {
    throw new Error('Pending sync requires the same signed-in user as when the item was queued.');
  }

  if (item.activityKey === 'parachute') {
    const payload = item.payload as ParachutePendingPayload;
    await uploadParachuteResult(
      userId,
      payload.teamData,
      payload.attempts,
      payload.location ?? undefined
    );
    return;
  }

  if (item.activityKey === 'sound') {
    const payload = item.payload as SoundPendingPayload;
    await uploadSoundResult(
      userId,
      payload.teamData,
      payload.measurements,
      payload.locationData
    );
    return;
  }
}

/**
 * Foreground-safe processor (also invoked from TaskManager task when OS allows).
 * Uses existing Firestore upload helpers — no payload shape changes.
 */
export async function processPendingSyncQueue(): Promise<PendingSyncProcessResult> {
  const result: PendingSyncProcessResult = {
    processed: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
  };

  if (!auth.currentUser?.uid) {
    if (__DEV__) {
      console.log('[PendingSync] Skipping queue processing — no signed-in user.');
    }
    return result;
  }

  const items = await getPendingSyncItems();
  if (items.length === 0) {
    return result;
  }

  for (const item of items) {
    if (item.status === 'failed') {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;

    try {
      await uploadPendingItem(item);
      await markPendingSyncSynced(item.id);
      result.synced += 1;
      if (__DEV__) {
        console.log(`[PendingSync] Synced ${item.activityKey} (${item.id}).`);
      }
    } catch (error) {
      await markPendingSyncFailed(item.id, PENDING_SYNC_MAX_RETRIES);
      result.failed += 1;
      if (__DEV__) {
        console.warn(`[PendingSync] Upload failed for ${item.id}.`, error);
      }
    }
  }

  return result;
}
