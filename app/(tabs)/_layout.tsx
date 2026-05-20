import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import AdBanner from '@/components/ui/AdBanner';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';

  return (
    <View style={styles.root}>
    <View style={styles.tabs}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors[theme].card,
          borderTopColor: Colors[theme].border,
          borderTopWidth: Platform.OS === 'android' ? 0 : 1,
          height: Platform.select({ ios: 86, default: 72 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: 26, default: 10 }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingHorizontal: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="earthquake"
        options={{
          title: 'Earthquake',
          tabBarIcon: ({ color }) => <MaterialIcons name="vibration" size={28} color={color} />,
        }}
      />
    </Tabs>
    </View>
    <AdBanner />
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
