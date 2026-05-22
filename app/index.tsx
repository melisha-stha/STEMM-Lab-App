import { useThemeColor } from '@/hooks/use-theme-color';
import { resolveAppRoute } from '@/hooks/app-routing';
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
      const destination = await resolveAppRoute(hasAuth);

      if (cancelled) return;

      setChecking(false);
      router.replace(destination);
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
