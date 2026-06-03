import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage queue — no SQLite schema changes. */
const PENDING_SYNC_QUEUE_KEY = '@stemm/pending_sync_queue';

export type PendingSyncStatus = 'pending' | 'synced' | 'failed';

/** Activities wired for pending sync fallback (extend same pattern to others). */
export type PendingSyncActivityKey = 'parachute' | 'sound';

export type ParachutePendingPayload = {
  teamData: Record<string, unknown> | null;
  attempts: unknown[];
  location: { latitude: number; longitude: number } | null;
};

export type SoundPendingPayload = {
  teamData: Record<string, unknown> | null;
  measurements: { db: number; label: string }[];
  locationData: { latitude: number; longitude: number } | null;
};

export type PendingSyncPayload = ParachutePendingPayload | SoundPendingPayload;

export type PendingSyncItem = {
  id: string;
  activityKey: PendingSyncActivityKey;
  createdAt: string;
  userId: string;
  teamId: string | number | null;
  teamName: string;
  payload: PendingSyncPayload;
  status: PendingSyncStatus;
  retryCount: number;
};

const MAX_QUEUE_ITEMS = 50;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function readQueue(): Promise<PendingSyncItem[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingSyncItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (__DEV__) console.warn('[PendingSync] Failed to read queue.', error);
    return [];
  }
}

async function writeQueue(items: PendingSyncItem[]): Promise<void> {
  const trimmed = items.slice(-MAX_QUEUE_ITEMS);
  await AsyncStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(trimmed));
}

export async function getPendingSyncItems(): Promise<PendingSyncItem[]> {
  const items = await readQueue();
  return items.filter((item) => item.status === 'pending');
}

export async function getPendingSyncQueueSnapshot(): Promise<PendingSyncItem[]> {
  return readQueue();
}

export async function getPendingSyncCount(): Promise<number> {
  const items = await getPendingSyncItems();
  return items.length;
}

export type EnqueuePendingSyncInput = {
  activityKey: PendingSyncActivityKey;
  userId: string;
  teamData: Record<string, unknown> | null | undefined;
  payload: PendingSyncPayload;
};

export async function enqueuePendingSync(input: EnqueuePendingSyncInput): Promise<PendingSyncItem> {
  const teamName = String(input.teamData?.name ?? 'unknown').trim() || 'unknown';
  const teamId =
    input.teamData?.id != null ? (input.teamData.id as string | number) : null;

  const item: PendingSyncItem = {
    id: createId(),
    activityKey: input.activityKey,
    createdAt: new Date().toISOString(),
    userId: input.userId,
    teamId,
    teamName,
    payload: input.payload,
    status: 'pending',
    retryCount: 0,
  };

  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);

  if (__DEV__) {
    console.log(`[PendingSync] Enqueued ${input.activityKey} (${item.id}). Queue size: ${queue.length}`);
  }

  return item;
}

export async function markPendingSyncSynced(id: string): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter((item) => item.id !== id);
  await writeQueue(next);
}

export async function markPendingSyncFailed(id: string, maxRetries: number): Promise<void> {
  const queue = await readQueue();
  const next = queue.map((item) => {
    if (item.id !== id) return item;
    const retryCount = item.retryCount + 1;
    return {
      ...item,
      retryCount,
      status: retryCount >= maxRetries ? ('failed' as const) : ('pending' as const),
    };
  });
  await writeQueue(next);
}

export async function removePendingSyncItem(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
}
