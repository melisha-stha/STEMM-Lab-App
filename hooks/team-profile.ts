import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from './firebaseConfig';
import { clearTeamData, getTeamData, saveTeamData } from './storage';

const SKIP_CLOUD_TEAM_RESTORE_KEY = '@team_skip_cloud_restore';

export type TeamProfile = {
  name: string;
  members: string[];
  grade: string;
  yearLevel?: string | null;
  learningLevel?: string | null;
  avatarKey?: string | null;
  id?: number;
};

export async function markSkipCloudTeamRestore(): Promise<void> {
  try {
    await AsyncStorage.setItem(SKIP_CLOUD_TEAM_RESTORE_KEY, '1');
  } catch (error) {
    console.warn('Failed to mark skip cloud team restore.', error);
  }
}

export async function clearSkipCloudTeamRestore(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SKIP_CLOUD_TEAM_RESTORE_KEY);
  } catch (error) {
    console.warn('Failed to clear skip cloud team restore.', error);
  }
}

async function shouldSkipCloudTeamRestore(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SKIP_CLOUD_TEAM_RESTORE_KEY)) === '1';
  } catch {
    return false;
  }
}

function isValidTeam(team: TeamProfile | null | undefined): team is TeamProfile {
  return Boolean(team?.name?.trim()) && Array.isArray(team?.members) && team.members.length > 0;
}

/** Saves team setup to Firestore. Never throws — local storage remains the source of truth. */
export async function saveTeamProfile(team: TeamProfile): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isValidTeam(team)) return false;

  try {
    await setDoc(
      doc(db, 'teamProfiles', uid),
      {
        name: team.name.trim(),
        members: team.members,
        grade: team.grade,
        yearLevel: team.yearLevel ?? null,
        learningLevel: team.learningLevel ?? null,
        avatarKey: team.avatarKey ?? null,
        id: team.id ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn(
      'Team profile cloud save failed (deploy firestore.rules for teamProfiles).',
      error
    );
    return false;
  }
}

/** Loads team profile from Firestore into local storage when missing on device. */
export async function restoreTeamProfileFromCloud(): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  if (await shouldSkipCloudTeamRestore()) return false;

  try {
    const snap = await getDoc(doc(db, 'teamProfiles', uid));
    if (!snap.exists()) return false;

    const data = snap.data() as TeamProfile;
    if (!isValidTeam(data)) return false;

    await saveTeamData(data.name, data.members, data.grade, {
      yearLevel: data.yearLevel ?? undefined,
      learningLevel: data.learningLevel ?? undefined,
      avatarKey: data.avatarKey ?? undefined,
      id: data.id ?? undefined,
    });

    return true;
  } catch (error) {
    console.warn('Team profile cloud restore skipped.', error);
    return false;
  }
}

/** Deletes cloud team profile for the signed-in user. */
export async function deleteTeamProfileFromCloud(): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;

  try {
    await deleteDoc(doc(db, 'teamProfiles', uid));
    return true;
  } catch (error) {
    console.warn('Team profile cloud delete failed.', error);
    return false;
  }
}

/**
 * Clears local team setup and cloud profile (when signed in) so the user can
 * run onboarding again without signing out.
 */
export async function resetTeamSetup(): Promise<'setup' | 'welcome'> {
  const signedIn = Boolean(auth.currentUser?.uid);

  await clearTeamData();
  if (signedIn) {
    await markSkipCloudTeamRestore();
    await deleteTeamProfileFromCloud();
    return 'setup';
  }

  return 'welcome';
}

export async function hasTeamProfile(): Promise<boolean> {
  const local = await getTeamData();
  if (isValidTeam(local)) return true;

  return restoreTeamProfileFromCloud();
}
