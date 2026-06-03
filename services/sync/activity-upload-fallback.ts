import { insertTrial } from '@/hooks/database';

import {
  enqueuePendingSync,
  type ParachutePendingPayload,
  type SoundPendingPayload,
} from './pending-sync-queue';

export async function queueParachuteUploadFallback(params: {
  userId: string;
  teamData: Record<string, unknown> | null | undefined;
  sanitizedAttempts: unknown[];
  locationData: { latitude: number; longitude: number } | null;
  bestDropTimeMs: number;
  bestVideoUri: string;
  latitudeForTrial: number | null;
  longitudeForTrial: number | null;
}): Promise<void> {
  const payload: ParachutePendingPayload = {
    teamData: params.teamData ?? null,
    attempts: params.sanitizedAttempts,
    location: params.locationData,
  };

  await enqueuePendingSync({
    activityKey: 'parachute',
    userId: params.userId,
    teamData: params.teamData,
    payload,
  });

  insertTrial(
    params.teamData?.name ? String(params.teamData.name) : 'unknown',
    'parachute',
    params.bestDropTimeMs,
    params.bestVideoUri,
    params.latitudeForTrial,
    params.longitudeForTrial
  );
}

export async function queueSoundUploadFallback(params: {
  userId: string;
  teamData: Record<string, unknown> | null | undefined;
  measurements: { db: number; label: string }[];
  locationData: { latitude: number; longitude: number } | null;
  peakDb: number;
  latitudeForTrial: number | null;
  longitudeForTrial: number | null;
}): Promise<void> {
  const payload: SoundPendingPayload = {
    teamData: params.teamData ?? null,
    measurements: params.measurements,
    locationData: params.locationData,
  };

  await enqueuePendingSync({
    activityKey: 'sound',
    userId: params.userId,
    teamData: params.teamData,
    payload,
  });

  insertTrial(
    params.teamData?.name ? String(params.teamData.name) : 'unknown',
    'sound',
    params.peakDb,
    '',
    params.latitudeForTrial,
    params.longitudeForTrial
  );
}
