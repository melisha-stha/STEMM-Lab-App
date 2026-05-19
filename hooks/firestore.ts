import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { db } from './firebaseConfig';

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

export const uploadParachuteResult = async (userId: string, teamData: any, attempts: any[], location?: any) => {
  try {
    const finalTeamName = teamData?.name || "Anonymous Team";
    const finalGrade = teamData?.grade || "N/A";

    const sanitizedLocation = location ? {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude)
    } : null;

    const docRef = await addDoc(collection(db, "parachute_results"), {
      userId: userId,
      teamName: finalTeamName, 
      grade: finalGrade,       
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