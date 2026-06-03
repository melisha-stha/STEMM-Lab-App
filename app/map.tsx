import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { SCREEN_BOTTOM_INSET, Spacing, TAB_BAR_HEIGHT, Typography } from '@/constants/design';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { getTrials } from '@/hooks/database';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const MAP_HEIGHT = 350;
/** Android PrimaryButton minHeight + clearance above floating tab bar */
const ANDROID_FOOTER_BTN_HEIGHT = 56;
const ANDROID_FLOATING_TAB_MARGIN = Spacing.md;

interface Trial {
  id: number;
  teamName: string;
  activity: string;
  time: number;
  latitude: number;
  longitude: number;
  createdAt: string;
}

function getMarkerColor(activity: string): string {
  switch (activity) {
    case 'parachute': return '#2196F3'; // blue
    case 'sound': return '#4CAF50';
    case 'handfan': return '#FF9800';     // orange
    case 'earthquake': return '#FF5722'; // red
    case 'reaction': return '#9C27B0';   // purple
    case 'breathing': return '#00BCD4';
    default: return '#9C27B0';           // purple
  }
}

function formatActivity(activity: string): string {
  switch (activity) {
    case 'parachute':
      return 'Parachute Drop';
    case 'sound':
      return 'Sound Pollution Hunter';
    case 'earthquake':
      return 'Earthquake Structure';
    case 'handfan':
      return 'Hand Fan Challenge';
    case 'reaction':
      return 'Reaction Board';
    case 'breathing':
      return 'Breathing Pace Trainer';
    case 'performance':
      return 'Human Performance Lab';
    default:
      return activity;
  }
}

function formatTime(ms: number, activity: string): string {
  if (activity === 'sound') return `${ms} dB`;
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}s`;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const isAndroid = Platform.OS === 'android';

  const scrollBottomPadding = isAndroid
    ? Math.max(tabBarHeight, TAB_BAR_HEIGHT) +
      ANDROID_FLOATING_TAB_MARGIN +
      ANDROID_FOOTER_BTN_HEIGHT +
      Spacing.lg +
      Math.max(insets.bottom, Spacing.md)
    : SCREEN_BOTTOM_INSET + insets.bottom;

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');

  useEffect(() => {
    try {
      const data = getTrials();
      const withLocation = data.filter(t => t.latitude && t.longitude);
      setTrials(withLocation);
    } catch (e) {
      console.error('Failed to load trials for map:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate initial region from trial data or default to Australia
  const initialRegion = trials.length > 0 ? {
    latitude: trials[0].latitude,
    longitude: trials[0].longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: -25.2744,
    longitude: 133.7751,
    latitudeDelta: 30,
    longitudeDelta: 30,
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: background }]} edges={['top']}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        isAndroid ? styles.contentAndroid : null,
        { paddingBottom: scrollBottomPadding },
      ]}
      nestedScrollEnabled={isAndroid}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Drop Site Map</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          GPS-tagged locations of all your team's activity trials.
        </Text>
      </View>

      {Platform.OS !== 'web' ? (
        <View style={[styles.mapContainer, { borderColor: border }]}>
          {loading ? (
            <View style={styles.mapPlaceholder}>
              <Text style={[styles.placeholderText, { color: mutedText }]}>Loading map...</Text>
            </View>
          ) : trials.length === 0 ? (
            <View style={styles.mapPlaceholder}>
              <Text style={[styles.placeholderText, { color: mutedText }]}>
                No GPS-tagged trials yet. Complete an activity to see pins here.
              </Text>
            </View>
          ) : (
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              showsUserLocation
              showsMyLocationButton
              scrollEnabled={!isAndroid}
              zoomEnabled={!isAndroid}
              rotateEnabled={!isAndroid}
              pitchEnabled={!isAndroid}
            >
              {trials.map((trial) => (
                <Marker
                  key={trial.id}
                  coordinate={{ latitude: trial.latitude, longitude: trial.longitude }}
                  pinColor={getMarkerColor(trial.activity)}
                >
                  <Callout>
                    <View style={styles.callout}>
                      <Text style={styles.calloutActivity}>{formatActivity(trial.activity)}</Text>
                      <Text style={styles.calloutTeam}>Team: {trial.teamName}</Text>
                      <Text style={styles.calloutResult}>Result: {formatTime(trial.time, trial.activity)}</Text>
                      <Text style={styles.calloutDate}>{new Date(trial.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>
          )}
        </View>
      ) : (
        <SectionCard>
          <Text style={[styles.placeholderText, { color: mutedText }]}>
            Map is not available on web. Open the app on your phone to view GPS-tagged trial locations.
          </Text>
        </SectionCard>
      )}

      {/* Legend */}
      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Map Legend</Text>
        {[
          { activity: 'parachute', color: '#2196F3', label: 'Parachute Drop' },
          { activity: 'sound', color: '#4CAF50', label: 'Sound Pollution Hunter' },
          { activity: 'earthquake', color: '#FF5722', label: 'Earthquake Structure' },
        ].map((item) => (
          <View key={item.activity} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendLabel, { color: mutedText }]}>{item.label}</Text>
          </View>
        ))}
      </SectionCard>

      {/* Trial list */}
      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Recorded Trials ({trials.length})</Text>
        {trials.length === 0 ? (
          <Text style={[styles.placeholderText, { color: mutedText }]}>No trials recorded yet.</Text>
        ) : (
          trials.map((trial) => (
            <View key={trial.id} style={[styles.trialRow, { borderColor: border, backgroundColor: card }]}>
              <View style={[styles.trialDot, { backgroundColor: getMarkerColor(trial.activity) }]} />
              <View style={styles.trialInfo}>
                <Text style={[styles.trialActivity, { color: text }]}>{formatActivity(trial.activity)}</Text>
                <Text style={[styles.trialDetail, { color: mutedText }]}>
                  {trial.teamName} • {formatTime(trial.time, trial.activity)}
                </Text>
                <Text style={[styles.trialDetail, { color: mutedText }]}>
                  {trial.latitude.toFixed(4)}, {trial.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          ))
        )}
      </SectionCard>

      <PrimaryButton
        label="Back to dashboard"
        variant="secondary"
        onPress={() => router.replace('/(tabs)')}
        style={styles.footerButton}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    flexGrow: 1,
  },
  contentAndroid: {
    flexGrow: 0,
  },
  footerButton: {
    marginTop: Spacing.sm,
  },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, marginBottom: Spacing.xs },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  mapContainer: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    height: MAP_HEIGHT,
  },
  map: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  mapPlaceholder: {
    height: MAP_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  placeholderText: { ...Typography.body, fontSize: 13, textAlign: 'center' },
  callout: { padding: 8, minWidth: 150 },
  calloutActivity: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  calloutTeam: { fontSize: 12, color: '#555' },
  calloutResult: { fontSize: 12, color: '#555' },
  calloutDate: { fontSize: 11, color: '#888', marginTop: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { ...Typography.body, fontSize: 13 },
  trialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.sm },
  trialDot: { width: 12, height: 12, borderRadius: 6 },
  trialInfo: { flex: 1 },
  trialActivity: { ...Typography.section, fontSize: 13 },
  trialDetail: { ...Typography.small, marginTop: 2 },
});