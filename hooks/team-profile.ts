import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from './firebaseConfig';
import { getTeamData, saveTeamData } from './storage';

export type TeamProfile = {
  name: string;
  members: string[];
  grade: string;
  yearLevel?: string | null;
  learningLevel?: string | null;
  id?: number;
};

function isValidTeam(team: TeamProfile | null | undefined): team is TeamProfile {
  return Boolean(team?.name?.trim()) && Array.isArray(team?.members) && team.members.length > 0;
}

export async function saveTeamProfile(team: TeamProfile): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isValidTeam(team)) return;

  await setDoc(
    doc(db, 'teamProfiles', uid),
    {
      name: team.name.trim(),
      members: team.members,
      grade: team.grade,
      yearLevel: team.yearLevel ?? null,
      learningLevel: team.learningLevel ?? null,
      id: team.id ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/** Loads team profile from Firestore into local storage when missing on device. */
export async function restoreTeamProfileFromCloud(): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  try {
    const snap = await getDoc(doc(db, 'teamProfiles', uid));
    if (!snap.exists()) return false;

    const data = snap.data() as TeamProfile;
    if (!isValidTeam(data)) return false;

    await saveTeamData(data.name, data.members, data.grade, {
      yearLevel: data.yearLevel ?? undefined,
      learningLevel: data.learningLevel ?? undefined,
    });

    return true;
  } catch (error) {
    console.error('Failed to restore team profile from cloud', error);
    return false;
  }
}

export async function hasTeamProfile(): Promise<boolean> {
  const local = await getTeamData();
  if (isValidTeam(local)) return true;

  return restoreTeamProfileFromCloud();
}
