import { ThemePreferenceProvider } from '@/contexts/theme-preference';
import { initDatabase } from '@/hooks/database';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function RootNavigation() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: 'transparent' },
          headerShown: false,
        }}>
        {/* Core Multi-Tab Shell Navigator Frame */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        
        {/* Onboarding and Device Setup Configurations */}
        <Stack.Screen name="welcome-screen" options={{ headerShown: false }} />
        <Stack.Screen name="setup-level" options={{ headerShown: false }} />
        <Stack.Screen name="setup-year" options={{ headerShown: false }} />
        <Stack.Screen name="setup-team" options={{ headerShown: false }} />
        
        {/* All 7 Fullscreen Lab Workspaces Registered for Expo Router */}
        <Stack.Screen name="parachute" options={{ headerShown: false }} />
        <Stack.Screen name="sound" options={{ headerShown: false }} />
        <Stack.Screen name="earthquake" options={{ headerShown: false }} />
        <Stack.Screen name="reaction" options={{ headerShown: false }} />
        <Stack.Screen name="breathing" options={{ headerShown: false }} />
        <Stack.Screen name="handfan" options={{ headerShown: false }} />
        <Stack.Screen name="performance" options={{ headerShown: false }} />

        {/* Dedicated Fullscreen Lab Result Dashboards */}
        <Stack.Screen name="breathing-results" options={{ headerShown: false }} />
        <Stack.Screen name="earthquake-results" options={{ headerShown: false }} />
        <Stack.Screen name="reaction-results" options={{ headerShown: false }} />
        <Stack.Screen name="parachute-results" options={{ headerShown: false }} />
        <Stack.Screen name="sound-results" options={{ headerShown: false }} />
        <Stack.Screen name="handfan-results" options={{ headerShown: false }} />
        <Stack.Screen name="performance-results" options={{ headerShown: false }} />

        {/* System Overlays and Info Modals */}
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <ThemePreferenceProvider>
      <RootNavigation />
    </ThemePreferenceProvider>
  );
}