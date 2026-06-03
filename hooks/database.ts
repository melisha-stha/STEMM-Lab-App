import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('stemmlab.db');
    console.log('SQLite: database opened');
  }
  return db;
};

export const initDatabase = () => {
  try {
    const database = getDb();
    database.execSync(
      `CREATE TABLE IF NOT EXISTS trials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teamName TEXT,
        activity TEXT,
        time INTEGER,
        videoUri TEXT,
        latitude REAL,
        longitude REAL,
        createdAt TEXT
      );`
    );
    console.log('SQLite: table created/verified');
  } catch (e) {
    console.error('SQLite initDatabase error:', e);
  }
};

export const insertTrial = (
  teamName: string,
  activity: string,
  time: number,
  videoUri: string,
  latitude: number | null,
  longitude: number | null
) => {
  try {
    const database = getDb();
    const values = {
      teamName: (teamName ?? 'unknown').trim() || 'unknown',
      activity: (activity ?? 'parachute').trim() || 'parachute',
      time: time ?? 0,
      videoUri: videoUri ?? '',
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      createdAt: new Date().toISOString(),
    };
    console.log('SQLite: inserting trial with values:', values);

    database.runSync(
      `INSERT INTO trials (teamName, activity, time, videoUri, latitude, longitude, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        values.teamName,
        values.activity,
        values.time,
        values.videoUri,
        values.latitude,
        values.longitude,
        values.createdAt,
      ]
    );
    console.log('SQLite: insert successful');
  } catch (e) {
    console.error('SQLite insertTrial error:', e);
  }
};

/** Match trials to the current team (trim + case-insensitive). */
export function filterTrialsByTeam<T extends { teamName?: string }>(
  trials: T[],
  teamName: string | null | undefined
): T[] {
  const normalized = (teamName ?? '').trim().toLowerCase();
  if (!normalized) return [];
  return trials.filter((row) => (row.teamName ?? '').trim().toLowerCase() === normalized);
}

export const getTrials = (): any[] => {
  try {
    const database = getDb();
    const results = database.getAllSync('SELECT * FROM trials ORDER BY createdAt DESC');
    console.log('SQLite: getTrials returned', results.length, 'rows');
    return results;
  } catch (e) {
    console.error('SQLite getTrials error:', e);
    return [];
  }
};