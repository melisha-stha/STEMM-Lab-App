import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationEngine } from '@/hooks/useNotificationEngine';

type TabIconName = keyof typeof MaterialIcons.glyphMap;

function TabBarIcon({
  name,
  color,
  focused,
  activeColor,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
  activeColor: string;
}) {
  return (
    <View style={styles.tabIconWrap}>
      <MaterialIcons name={name} size={24} color={color} />
      {focused ? (
        <View style={[styles.tabActiveDot, { backgroundColor: activeColor }]} />
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  useNotificationEngine();

  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const themeColors = colors as any;

  const activeColor = themeColors?.tabBar?.active ?? themeColors?.primary ?? '#A855F7';
  const inactiveColor = themeColors?.tabBar?.inactive ?? themeColors?.mutedText ?? '#8E8E93';
  const tabBgColor = themeColors?.tabBar?.background ?? themeColors?.card ?? (colorScheme === 'dark' ? '#121212' : '#FFFFFF');
  const borderColor = themeColors?.border ?? '#E5E5EA';
  const shadowColor = themeColors?.shadow ?? '#000000';

  const renderIcon = (name: TabIconName) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <TabBarIcon
        name={name}
        color={color}
        focused={focused}
        activeColor={activeColor}
      />
    );

return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.tabs}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: activeColor,
            tabBarInactiveTintColor: inactiveColor,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              backgroundColor: tabBgColor,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              borderRadius: Radius.xl,
              marginHorizontal: Spacing.md,
              marginBottom: Spacing.md,
              height: 64,
              position: 'absolute',
              shadowColor: shadowColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: colorScheme === 'light' ? 0.1 : 0.25,
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
              tabBarIcon: renderIcon('home'),
            }}
          />
          <Tabs.Screen
            name="leaderboard"
            options={{
              title: 'Ranks',
              tabBarIcon: renderIcon('leaderboard'),
            }}
          />
          <Tabs.Screen
            name="map"
            options={{
              title: 'Map',
              tabBarIcon: renderIcon('map'),
            }}
          />
          <Tabs.Screen
            name="team"
            options={{
              title: 'Team',
              tabBarIcon: renderIcon('groups'),
            }}
          />
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
  tabIconWrap: {
    alignItems: 'center',
  },
  tabActiveDot: {
    width: 4,
    height: 4,
    marginTop: 2,
  },
});