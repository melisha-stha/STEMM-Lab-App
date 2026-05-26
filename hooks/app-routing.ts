import { type Href } from 'expo-router';

import { hasTeamProfile } from './team-profile';

export async function hasTeamSaved(): Promise<boolean> {
  return hasTeamProfile();
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
