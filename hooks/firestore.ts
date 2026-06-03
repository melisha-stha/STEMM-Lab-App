import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from './firebaseConfig';

export type TeamMapLocation = {
  id: string;
  activity: string;
  latitude: number;
  longitude: number;
  time: number;
  createdAt: string;
  source: 'cloud';
};

type TeamMapContext = {
  teamId?: string | number | null;
  teamName?: string | null;
};

type MapCollectionConfig = {
  collectionName: string;
  activity: string;
  locationField: 'location' | 'locationData';
  resolveTime: (data: Record<string, unknown>) => number;
};

const TEAM_MAP_COLLECTIONS: MapCollectionConfig[] = [
  {
    collectionName: 'parachute_results',
    activity: 'parachute',
    locationField: 'location',
    resolveTime: (data) => Number(data.bestTime ?? 0),
  },
  {
    collectionName: 'soundResults',
    activity: 'sound',
    locationField: 'locationData',
    resolveTime: (data) => Number(data.peakDb ?? 0),
  },
  {
    collectionName: 'earthquakeResults',
    activity: 'earthquake',
    locationField: 'locationData',
    resolveTime: (data) => Number(data.bestScore ?? 0),
  },
  {
    collectionName: 'reactionResults',
    activity: 'reaction',
    locationField: 'locationData',
    resolveTime: (data) => Number(data.bestReactionTime ?? data.avgReactionTimeMs ?? 0),
  },
  {
    collectionName: 'breathingResults',
    activity: 'breathing',
    locationField: 'locationData',
    resolveTime: (data) => Number(data.restingBpm ?? 0),
  },
  {
    collectionName: 'handfanResults',
    activity: 'handfan',
    locationField: 'locationData',
    resolveTime: (data) => Number(data.bestBendAngle ?? 0),
  },
  {
    collectionName: 'performanceResults',
    activity: 'performance',
    locationField: 'locationData',
    resolveTime: (data) => Number(data.bestControlScore ?? 0),
  },
];

function toCreatedAtIso(createdAt: unknown): string {
  if (!createdAt) return '';
  if (typeof createdAt === 'string') return createdAt;
  if (
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (createdAt as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

function hasValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  );
}

function readLocation(
  data: Record<string, unknown>,
  locationField: 'location' | 'locationData'
): { latitude: number; longitude: number } | null {
  const raw = data[locationField];
  if (!raw || typeof raw !== 'object') return null;
  const latitude = Number((raw as { latitude?: unknown }).latitude);
  const longitude = Number((raw as { longitude?: unknown }).longitude);
  if (!hasValidCoordinates(latitude, longitude)) return null;
  return { latitude, longitude };
}

/** Client-side guard: only records for this signed-in user and team. */
export function belongsToCurrentTeam(
  data: Record<string, unknown>,
  userId: string,
  teamContext: TeamMapContext
): boolean {
  if (data.userId !== userId) return false;

  const contextTeamId = teamContext.teamId;
  const recordTeamId = data.teamId;
  if (contextTeamId != null && recordTeamId != null) {
    return String(recordTeamId) === String(contextTeamId);
  }

  const contextTeamName = (teamContext.teamName ?? '').trim().toLowerCase();
  if (!contextTeamName) return true;

  const recordTeamName = String(data.teamName ?? '')
    .trim()
    .toLowerCase();
  return recordTeamName === contextTeamName;
}

function docToTeamMapLocation(
  docId: string,
  data: Record<string, unknown>,
  config: MapCollectionConfig
): TeamMapLocation | null {
  const coords = readLocation(data, config.locationField);
  if (!coords) return null;

  return {
    id: `${config.collectionName}-${docId}`,
    activity: config.activity,
    latitude: coords.latitude,
    longitude: coords.longitude,
    time: config.resolveTime(data),
    createdAt: toCreatedAtIso(data.createdAt),
    source: 'cloud',
  };
}

/**
 * Live map pins for the signed-in user's team only (Firestore queries by userId).
 * Leaderboard subscriptions are unchanged.
 */
export function subscribeToTeamMapLocations(
  userId: string,
  teamContext: TeamMapContext,
  callback: (locations: TeamMapLocation[]) => void
): () => void {
  const buckets: Record<string, TeamMapLocation[]> = {};

  const emit = () => {
    callback(Object.values(buckets).flat());
  };

  const unsubscribes = TEAM_MAP_COLLECTIONS.map((config) => {
    const q = query(collection(db, config.collectionName), where('userId', '==', userId));

    return onSnapshot(
      q,
      (snapshot) => {
        buckets[config.collectionName] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            if (!belongsToCurrentTeam(data, userId, teamContext)) return null;
            return docToTeamMapLocation(docSnap.id, data, config);
          })
          .filter((row): row is TeamMapLocation => row !== null);
        emit();
      },
      (error) => {
        console.error(`[Map] Firestore listen failed for ${config.collectionName}:`, error);
        buckets[config.collectionName] = [];
        emit();
      }
    );
  });

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export type SoundLeaderboardEntry = {
  id: string;
  teamName: string;
  grade: string;
  measurements: { db: number; label: string }[];
  locationData?: { latitude: number; longitude: number } | null;
  createdAt: string;
  peakDb?: number;
  teamId?: string | number;
  userId?: string;
};

export type EarthquakeLeaderboardEntry = {
  id: string;
  teamName: string;
  grade: string;
  attempts: { score: number; duration: number }[];
  bestScore: number;
  locationData?: { latitude: number; longitude: number } | null;
  createdAt: string;
  teamId?: string | number;
  userId?: string;
};

export type ReactionAttempt = {
  phase: 1 | 2 | 3;
  reactionTime?: number;
  tooEarly?: boolean;
};

export const uploadParachuteResult = async (userId: string, teamData: any, attempts: any[], location?: any) => {
  try {
    const finalTeamName = teamData?.name || "Anonymous Team";
    const finalGrade = teamData?.grade || "N/A";
    const teamId = teamData?.id ?? null;
    const yearLevel = teamData?.yearLevel ?? null;
    const learningLevel = teamData?.learningLevel ?? null;
    const avatarKey = teamData?.avatarKey ?? null;

    const sanitizedLocation = location ? {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude)
    } : null;

    const docRef = await addDoc(collection(db, "parachute_results"), {
      userId: userId,
      teamName: finalTeamName, 
      grade: finalGrade,       
      teamId,
      yearLevel,
      learningLevel,
      avatarKey,
      attempts: attempts,
      bestTime: Math.max(...attempts.map(a => a.time)), 
      location: sanitizedLocation,
      createdAt: serverTimestamp(),
    });

    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error syncing data to Firestore: ", error);
    throw error;
  }
};

export const subscribeToLeaderboard = (callback: (data: any[]) => void) => {
  const q = query(
    collection(db, "parachute_results"), 
    orderBy("bestTime", "desc"), // Slowest flight (highest number) at the top
    limit(10)
  );

  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(results);
  });
};

export const uploadSoundResult = async (
  userId: string,
  teamData: any,
  measurements: { db: number; label: string }[],
  locationData: { latitude: number; longitude: number } | null
) => {
  const peakDb =
    measurements.length > 0 ? Math.max(...measurements.map((m) => m.db)) : 0;

  const docRef = await addDoc(collection(db, 'soundResults'), {
    userId,
    teamName: teamData?.name || 'unknown',
    grade: teamData?.grade || '',
    teamId: teamData?.id ?? null,
    yearLevel: teamData?.yearLevel ?? null,
    learningLevel: teamData?.learningLevel ?? null,
    avatarKey: teamData?.avatarKey ?? null,
    measurements,
    peakDb,
    locationData,
    createdAt: new Date().toISOString(),
  });
  console.log('Sound result saved with ID:', docRef.id);
};

/**
 * Uploads an earthquake stability trial to Firestore.
 * Parallel-called with insertTrial (SQLite) from earthquake.tsx finishAndSave.
 */
export const uploadEarthquakeResult = async (
  userId: string,
  teamData: any,
  attempts: { score: number; duration: number }[],
  location?: { latitude: number; longitude: number } | null
): Promise<void> => {
  const bestAttempt = attempts.reduce((best, a) => (a.score > best.score ? a : best));

  await addDoc(collection(db, 'earthquakeResults'), {
    userId,
    teamName: teamData?.name ?? 'Anonymous Team',
    grade: teamData?.grade ?? 'N/A',
    teamId: teamData?.id ?? null,
    yearLevel: teamData?.yearLevel ?? null,
    learningLevel: teamData?.learningLevel ?? null,
    avatarKey: teamData?.avatarKey ?? null,
    attempts,
    bestScore: bestAttempt.score,
    locationData: location
      ? { latitude: Number(location.latitude), longitude: Number(location.longitude) }
      : null,
    createdAt: new Date().toISOString(),
  });
};

/**
 * Subscribes to the top 10 sound results ordered by peak dB descending.
 * Higher dB = louder environment measured. Unsubscribe by calling the returned function.
 */
export const subscribeToSoundLeaderboard = (
  callback: (results: SoundLeaderboardEntry[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'soundResults'),
    orderBy('peakDb', 'desc'),
    limit(10)
  );
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SoundLeaderboardEntry[];
    callback(results);
  });
};

/**
 * Subscribes to the top 10 earthquake results ordered by bestScore descending.
 * Higher stability score = more stable structure = better result.
 * Unsubscribe by calling the returned function.
 */
export const subscribeToEarthquakeLeaderboard = (
  callback: (results: EarthquakeLeaderboardEntry[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'earthquakeResults'),
    orderBy('bestScore', 'desc'),
    limit(10)
  );
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EarthquakeLeaderboardEntry[];
    callback(results);
  });
};

/**
 * Uploads a reaction board trial to Firestore.
 * Parallel-called with insertTrial (SQLite) from reaction.tsx saveResults.
 */
export const uploadReactionResult = async (
  userId: string,
  teamData: any,
  attempts: ReactionAttempt[],
  location?: { latitude: number; longitude: number } | null
): Promise<void> => {
  const phase1Attempts = attempts.filter(
    (a) => a.phase === 1 && !a.tooEarly && a.reactionTime != null
  );
  const phase2Attempts = attempts.filter(
    (a) => a.phase === 2 && !a.tooEarly && a.reactionTime != null
  );
  const phase3Attempts = attempts.filter(
    (a) => a.phase === 3 && !a.tooEarly && a.reactionTime != null
  );

  const avgPhase1 =
    phase1Attempts.length > 0
      ? phase1Attempts.reduce((sum, a) => sum + (a.reactionTime ?? 0), 0) / phase1Attempts.length
      : null;

  const avgPhase2 =
    phase2Attempts.length > 0
      ? phase2Attempts.reduce((sum, a) => sum + (a.reactionTime ?? 0), 0) / phase2Attempts.length
      : null;

  const avgPhase3 =
    phase3Attempts.length > 0
      ? phase3Attempts.reduce((sum, a) => sum + (a.reactionTime ?? 0), 0) / phase3Attempts.length
      : null;

  const timedAttempts = [...phase1Attempts, ...phase2Attempts, ...phase3Attempts];
  const bestReactionTime =
    timedAttempts.length > 0
      ? Math.min(...timedAttempts.map((a) => a.reactionTime as number))
      : null;
  const avgReactionTimeMs =
    timedAttempts.length > 0
      ? Math.round(
          timedAttempts.reduce((sum, a) => sum + (a.reactionTime ?? 0), 0) / timedAttempts.length
        )
      : null;

  await addDoc(collection(db, 'reactionResults'), {
    userId,
    teamName: teamData?.name ?? 'Anonymous Team',
    grade: teamData?.grade ?? 'N/A',
    teamId: teamData?.id ?? null,
    yearLevel: teamData?.yearLevel ?? null,
    learningLevel: teamData?.learningLevel ?? null,
    avatarKey: teamData?.avatarKey ?? null,
    attempts,
    avgPhase1ReactionTime: avgPhase1,
    avgPhase2ReactionTime: avgPhase2,
    avgPhase3ReactionTime: avgPhase3,
    avgReactionTimeMs,
    bestReactionTime,
    locationData: location
      ? { latitude: Number(location.latitude), longitude: Number(location.longitude) }
      : null,
    createdAt: new Date().toISOString(),
  });
};

export type ReactionLeaderboardEntry = {
  id: string;
  teamName: string;
  grade: string;
  yearLevel?: string;
  teamId?: string | number;
  avatarKey?: string | null;
  avgReactionTimeMs?: number | null;
  bestReactionTime: number;
  avgPhase1ReactionTime: number | null;
  avgPhase2ReactionTime: number | null;
  avgPhase3ReactionTime: number | null;
  locationData?: { latitude: number; longitude: number } | null;
  createdAt: string;
};

/**
 * Subscribes to top 10 reaction results ordered by avgReactionTimeMs ascending.
 * Lower average time = faster reaction = better result.
 */
export const subscribeToReactionLeaderboard = (
  callback: (results: ReactionLeaderboardEntry[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'reactionResults'),
    orderBy('avgReactionTimeMs', 'asc'),
    limit(10)
  );
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ReactionLeaderboardEntry[];
    callback(results);
  });
};

export type BreathingSession = {
  label: string;
  bpm: number;
  duration: number;
};

export type BreathingLeaderboardEntry = {
  id: string;
  teamName: string;
  grade: string;
  yearLevel?: string;
  teamId?: string | number;
  avatarKey?: string | null;
  sessions: BreathingSession[];
  restingBpm: number;
  sessionsCount?: number;
  locationData?: { latitude: number; longitude: number } | null;
  createdAt: string;
};

/**
 * Uploads a breathing pace trial to Firestore.
 * Parallel-called with insertTrial (SQLite) from breathing.tsx saveResults.
 */
export const uploadBreathingResult = async (
  userId: string,
  teamData: any,
  sessions: BreathingSession[],
  location?: { latitude: number; longitude: number } | null
): Promise<void> => {
  const restingSession = sessions.find((s) => s.label === 'At Rest');

  await addDoc(collection(db, 'breathingResults'), {
    userId,
    teamName: teamData?.name ?? 'Anonymous Team',
    grade: teamData?.grade ?? 'N/A',
    teamId: teamData?.id ?? null,
    yearLevel: teamData?.yearLevel ?? null,
    learningLevel: teamData?.learningLevel ?? null,
    avatarKey: teamData?.avatarKey ?? null,
    sessions,
    restingBpm: restingSession?.bpm ?? 0,
    sessionsCount: Array.isArray(sessions) ? sessions.length : 0,
    locationData: location
      ? { latitude: Number(location.latitude), longitude: Number(location.longitude) }
      : null,
    createdAt: new Date().toISOString(),
  });
};

/**
 * Subscribes to top 10 breathing results ordered by sessionsCount descending.
 * Ranking is based on completion (how many sessions were recorded).
 */
export const subscribeToBreathingLeaderboard = (
  callback: (results: BreathingLeaderboardEntry[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'breathingResults'),
    orderBy('sessionsCount', 'desc'),
    limit(10)
  );
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BreathingLeaderboardEntry[];
    callback(results);
  });
};

export const uploadHandFanResult = async (
  userId: string,
  teamData: any,
  designs: any[],
  locationData: any
) => {
  const bestBendAngle =
    Array.isArray(designs) && designs.length
      ? Math.max(
          ...designs.map((d) => {
            const v = Number.parseFloat(String(d?.bendAngle ?? ''));
            return Number.isFinite(v) ? v : 0;
          })
        )
      : 0;
  const docRef = await addDoc(collection(db, 'handfanResults'), {
    userId,
    teamName: teamData?.name || 'unknown',
    grade: teamData?.grade || '',
    teamId: teamData?.id ?? null,
    yearLevel: teamData?.yearLevel ?? null,
    learningLevel: teamData?.learningLevel ?? null,
    avatarKey: teamData?.avatarKey ?? null,
    designs,
    bestBendAngle,
    locationData,
    createdAt: new Date().toISOString(),
  });
  console.log('Hand Fan result saved with ID:', docRef.id);
};

export type HandFanLeaderboardEntry = {
  id: string;
  teamName: string;
  grade: string;
  yearLevel?: string;
  teamId?: string | number;
  avatarKey?: string | null;
  bestBendAngle?: number;
  createdAt: string;
};

/**
 * Subscribes to top 10 hand fan results ordered by bestBendAngle descending.
 * Higher bend angle = stronger fan effect.
 */
export const subscribeToHandFanLeaderboard = (
  callback: (results: HandFanLeaderboardEntry[]) => void
): (() => void) => {
  const q = query(collection(db, 'handfanResults'), orderBy('bestBendAngle', 'desc'), limit(10));
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as HandFanLeaderboardEntry[];
    callback(results);
  });
};

export const uploadPerformanceResult = async (
  userId: string,
  teamData: any,
  attempts: any[],
  locationData: any
) => {
  const bestAvgForce =
    Array.isArray(attempts) && attempts.length
      ? Math.min(
          ...attempts.map((a) => {
            const v = Number(a?.averageForce);
            return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
          })
        )
      : null;
  const bestControlScore =
    bestAvgForce == null || !Number.isFinite(bestAvgForce)
      ? null
      : Math.max(0, 1000 - Math.round(bestAvgForce * 1000));
  const docRef = await addDoc(collection(db, 'performanceResults'), {
    userId,
    teamName: teamData?.name || 'unknown',
    grade: teamData?.grade || '',
    teamId: teamData?.id ?? null,
    yearLevel: teamData?.yearLevel ?? null,
    learningLevel: teamData?.learningLevel ?? null,
    avatarKey: teamData?.avatarKey ?? null,
    attempts,
    bestAvgForce,
    bestControlScore,
    locationData,
    createdAt: new Date().toISOString(),
  });
  console.log('Performance result saved with ID:', docRef.id);
};

export type PerformanceLeaderboardEntry = {
  id: string;
  teamName: string;
  grade: string;
  yearLevel?: string;
  teamId?: string | number;
  avatarKey?: string | null;
  bestControlScore?: number | null;
  bestAvgForce?: number | null;
  createdAt: string;
};

/**
 * Subscribes to top 10 performance results ordered by bestControlScore descending.
 * Higher control score = smoother movement (less vibration).
 */
export const subscribeToPerformanceLeaderboard = (
  callback: (results: PerformanceLeaderboardEntry[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'performanceResults'),
    orderBy('bestControlScore', 'desc'),
    limit(10)
  );
  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PerformanceLeaderboardEntry[];
    callback(results);
  });
};