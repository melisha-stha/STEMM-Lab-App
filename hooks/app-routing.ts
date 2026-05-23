import { type Href } from 'expo-router';

import { getTeamData } from './storage';

export async function hasTeamSaved(): Promise<boolean> {
  const team = await getTeamData();
  return Boolean(team?.name) && Array.isArray(team?.members) && team.members.length > 0;
}

export async function resolveAppRoute(hasAuth: boolean): Promise<Href> {
  if (!hasAuth) {
    return '/welcome-screen';
  }

  const hasTeam = await hasTeamSaved();
  if (!hasTeam) {
    return '/setup-level';
  }

  return '/(tabs)';
}

export async function resolvePostLoginRoute(): Promise<Href> {
  const hasTeam = await hasTeamSaved();
  return hasTeam ? '/(tabs)' : '/setup-level';
}
