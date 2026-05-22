import { useThemeColor } from '@/hooks/use-theme-color';
import { getTeamData } from '@/hooks/storage';
import { type Href, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { auth } from '../hooks/firebaseConfig';

export default function IndexRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');

  useEffect(() => {
    let cancelled = false;

    const routeUser = async (hasAuth: boolean) => {
      const team = await getTeamData();
      const hasTeam =
        Boolean(team?.name) && Array.isArray(team?.members) && team.members.length > 0;

      if (cancelled) return;

      if (!hasTeam) {
        router.replace('/welcome' as Href);
        return;
      }

      setChecking(false);
      if (hasAuth) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void routeUser(Boolean(user));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  if (!checking) return null;

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <ActivityIndicator size="large" color={primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
