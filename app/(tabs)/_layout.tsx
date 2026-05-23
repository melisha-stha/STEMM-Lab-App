import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.tabs}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.tabBarActive,
            tabBarInactiveTintColor: colors.tabBarInactive,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              backgroundColor: colors.tabBar,
              borderTopWidth: 0,
              borderRadius: Radius.xl,
              marginHorizontal: Spacing.md,
              marginBottom: Spacing.md,
              height: 64,
              position: 'absolute',
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 16,
              paddingTop: Spacing.sm,
              paddingBottom: Platform.select({ ios: Spacing.sm, default: Spacing.sm }),
            },
            tabBarLabelStyle: {
              fontSize: FontSize.xs,
              fontWeight: FontWeight.medium,
              marginBottom: 4,
            },
            tabBarItemStyle: {
              paddingHorizontal: 4,
            },
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: 'Streams',
              tabBarIcon: ({ color }) => <MaterialIcons name="category" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="leaderboard"
            options={{
              title: 'Ranks',
              tabBarIcon: ({ color }) => <MaterialIcons name="leaderboard" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="map"
            options={{
              title: 'Map',
              tabBarIcon: ({ color }) => <MaterialIcons name="map" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="team"
            options={{
              title: 'Team',
              tabBarIcon: ({ color }) => <MaterialIcons name="groups" size={24} color={color} />,
            }}
          />
          <Tabs.Screen name="earthquake" options={{ href: null }} />
          <Tabs.Screen name="reaction" options={{ href: null }} />
          <Tabs.Screen name="breathing" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabs: {
    flex: 1,
  },
});
