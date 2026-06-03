import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenBackButton } from '@/components/ui/screen-back-button';
import { SectionCard } from '@/components/ui/section-card';
import { SCREEN_BOTTOM_INSET, Spacing, TAB_BAR_HEIGHT, Typography } from '@/constants/design';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { filterTrialsByTeam, getTrials } from '@/hooks/database';
import { auth } from '@/hooks/firebaseConfig';
import {
  subscribeToTeamMapLocations,
  type TeamMapLocation,
} from '@/hooks/firestore';
import { getTeamData } from '@/hooks/storage';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const MAP_HEIGHT = 350;
/** Android PrimaryButton minHeight + clearance above floating tab bar */
const ANDROID_FOOTER_BTN_HEIGHT = 56;
const ANDROID_FLOATING_TAB_MARGIN = Spacing.md;

type MapTrialPin = {
  id: string;
  activity: string;
  time: number;
  latitude: number;
  longitude: number;
  createdAt: string;
  source: 'local' | 'cloud';
};

function hasValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  );
}

function markerDedupeKey(pin: Pick<MapTrialPin, 'activity' | 'latitude' | 'longitude'>): string {
  return `${pin.activity}:${pin.latitude.toFixed(4)}:${pin.longitude.toFixed(4)}`;
}

function mergeMapPins(localPins: MapTrialPin[], cloudPins: TeamMapLocation[]): MapTrialPin[] {
  const cloudKeys = new Set(cloudPins.map(markerDedupeKey));
  const merged: MapTrialPin[] = [...cloudPins];

  for (const localPin of localPins) {
    if (!cloudKeys.has(markerDedupeKey(localPin))) {
      merged.push(localPin);
    }
  }

  return merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function getMarkerColor(activity: string): string {
  switch (activity) {
    case 'parachute':
      return '#2196F3';
    case 'sound':
      return '#4CAF50';
    case 'handfan':
      return '#FF9800';
    case 'earthquake':
      return '#FF5722';
    case 'reaction':
      return '#9C27B0';
    case 'breathing':
      return '#00BCD4';
    case 'performance':
      return '#E91E63';
    default:
      return '#9C27B0';
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
  if (activity === 'breathing') return `${ms} BPM`;
  if (activity === 'earthquake') return `Score ${ms}`;
  if (activity === 'handfan') return `${ms}° bend`;
  if (activity === 'performance') return `Control ${ms}`;
  if (activity === 'reaction') return `${ms} ms`;
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}s`;
}

function formatPinDate(createdAt: string): string {
  if (!createdAt) return '';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
}

function loadLocalTeamPins(teamName: string | null | undefined): MapTrialPin[] {
  const rows = filterTrialsByTeam(getTrials(), teamName);
  const pins: MapTrialPin[] = [];

  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!hasValidCoordinates(latitude, longitude)) continue;

    pins.push({
      id: `local-${row.id}`,
      activity: String(row.activity ?? 'parachute'),
      time: Number(row.time ?? 0),
      latitude,
      longitude,
      createdAt: String(row.createdAt ?? ''),
      source: 'local',
    });
  }

  return pins;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [trials, setTrials] = useState<MapTrialPin[]>([]);
  const [cloudTrials, setCloudTrials] = useState<TeamMapLocation[]>([]);
  const [teamLabel, setTeamLabel] = useState('Your team');
  const [userId, setUserId] = useState<string | null>(auth?.currentUser?.uid ?? null);
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

  const refreshLocalPins = useCallback(async () => {
    const team = await getTeamData();
    const label = team?.name?.trim() || 'Your team';
    setTeamLabel(label);
    setTrials(loadLocalTeamPins(team?.name));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);
        try {
          if (!active) return;
          await refreshLocalPins();
        } catch (e) {
          console.error('Failed to load trials for map:', e);
          if (active) setTrials([]);
        } finally {
          if (active) setLoading(false);
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [refreshLocalPins])
  );

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!userId) {
      setCloudTrials([]);
      return;
    }

    let unsubscribeMap: (() => void) | undefined;

    const startSubscription = async () => {
      const team = await getTeamData();
      const label = team?.name?.trim() || 'Your team';
      setTeamLabel(label);

      unsubscribeMap = subscribeToTeamMapLocations(
        userId,
        { teamId: team?.id ?? null, teamName: team?.name ?? null },
        (locations) => {
          setCloudTrials(locations);
        }
      );
    };

    void startSubscription();

    return () => {
      unsubscribeMap?.();
    };
  }, [userId]);

  const mapPins = useMemo(() => mergeMapPins(trials, cloudTrials), [trials, cloudTrials]);

  const initialRegion =
    mapPins.length > 0
      ? {
          latitude: mapPins[0].latitude,
          longitude: mapPins[0].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : {
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
        <ScreenBackButton />
        <View style={styles.header}>
          <Text style={[styles.title, { color: text }]}>Drop Site Map</Text>
          <Text style={[styles.subtitle, { color: mutedText }]}>
            GPS-tagged locations from your team's saved activity results.
          </Text>
          <Text style={[styles.privacyNote, { color: mutedText }]}>
            Map pins only show your team's saved activity locations.
          </Text>
        </View>

        {Platform.OS !== 'web' ? (
          <View style={[styles.mapContainer, { borderColor: border }]}>
            {loading ? (
              <View style={styles.mapPlaceholder}>
                <Text style={[styles.placeholderText, { color: mutedText }]}>Loading map...</Text>
              </View>
            ) : mapPins.length === 0 ? (
              <View style={styles.mapPlaceholder}>
                <Text style={[styles.placeholderText, { color: mutedText }]}>
                  No saved drop sites yet
                </Text>
                <Text style={[styles.placeholderSubtext, { color: mutedText }]}>
                  Complete an activity with location enabled to see it here.
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
                pitchEnabled={!isAndroid}>
                {mapPins.map((trial) => (
                  <Marker
                    key={trial.id}
                    coordinate={{ latitude: trial.latitude, longitude: trial.longitude }}
                    pinColor={getMarkerColor(trial.activity)}>
                    <Callout>
                      <View style={styles.callout}>
                        <Text style={styles.calloutActivity}>{formatActivity(trial.activity)}</Text>
                        <Text style={styles.calloutTeam}>{teamLabel}</Text>
                        <Text style={styles.calloutResult}>
                          Result: {formatTime(trial.time, trial.activity)}
                        </Text>
                        {trial.createdAt ? (
                          <Text style={styles.calloutDate}>{formatPinDate(trial.createdAt)}</Text>
                        ) : null}
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
              Map is not available on web. Open the app on your phone to view your team's saved
              activity locations.
            </Text>
          </SectionCard>
        )}

        <SectionCard>
          <Text style={[styles.sectionTitle, { color: text }]}>
            Your Team's Saved Sites ({mapPins.length})
          </Text>
          {mapPins.length === 0 ? (
            <Text style={[styles.placeholderText, { color: mutedText }]}>
              No saved drop sites yet. Complete an activity with location enabled to see it here.
            </Text>
          ) : (
            mapPins.map((trial) => (
              <View
                key={trial.id}
                style={[styles.trialRow, { borderColor: border, backgroundColor: card }]}>
                <View style={[styles.trialDot, { backgroundColor: getMarkerColor(trial.activity) }]} />
                <View style={styles.trialInfo}>
                  <Text style={[styles.trialActivity, { color: text }]}>
                    {formatActivity(trial.activity)}
                  </Text>
                  <Text style={[styles.trialDetail, { color: mutedText }]}>
                    {teamLabel} • {formatTime(trial.time, trial.activity)}
                  </Text>
                  {trial.createdAt ? (
                    <Text style={[styles.trialDetail, { color: mutedText }]}>
                      {formatPinDate(trial.createdAt)}
                    </Text>
                  ) : null}
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
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  privacyNote: { marginTop: Spacing.sm, ...Typography.small, lineHeight: 18 },
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
    gap: Spacing.sm,
  },
  placeholderText: { ...Typography.body, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  placeholderSubtext: { ...Typography.body, fontSize: 13, textAlign: 'center' },
  callout: { padding: 8, minWidth: 150 },
  calloutActivity: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  calloutTeam: { fontSize: 12, color: '#555' },
  calloutResult: { fontSize: 12, color: '#555' },
  calloutDate: { fontSize: 11, color: '#888', marginTop: 2 },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  trialDot: { width: 12, height: 12, borderRadius: 6 },
  trialInfo: { flex: 1 },
  trialActivity: { ...Typography.section, fontSize: 13 },
  trialDetail: { ...Typography.small, marginTop: 2 },
});
