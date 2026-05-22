import { type Href } from 'expo-router';

import { getTeamData } from './storage';

export async function hasTeamSaved(): Promise<boolean> {
  const team = await getTeamData();
  return Boolean(team?.name) && Array.isArray(team?.members) && team.members.length > 0;
}

export async function resolveAppRoute(hasAuth: boolean): Promise<Href> {
  const hasTeam = await hasTeamSaved();

  if (!hasTeam) {
    return hasAuth ? '/setup-level' : '/welcome-screen';
  }

  if (!hasAuth) {
    return '/login';
  }

  return '/(tabs)';
}
