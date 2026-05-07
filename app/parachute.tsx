import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AttemptRow } from '@/components/ui/attempt-row';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionCard } from '@/components/ui/section-card';
import { Radius, Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { auth } from '../hooks/firebaseConfig';
import { uploadParachuteResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

export default function ParachuteScreen() {
  const router = useRouter();
  
  const [isActive, setIsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [time, setTime] = useState(0); 
  const [attempts, setAttempts] = useState<{ time: number; videoUri?: string }[]>([]);  
  const [subscription, setSubscription] = useState<any>(null);
  const [liveForce, setLiveForce] = useState(1.0);
  const [locationStatus, setLocationStatus] = useState("📡 Searching...");
  const timerRef = useRef<any>(null);
  const timeRef = useRef(0);
  

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'card');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationStatus("✅ Fixed");
      } else {
        setLocationStatus("❌ Off");
      }
    })();
  }, []);
  
  const startAccelerometer = () => {
    // ONLY run this if the device is NOT web
    if (Platform.OS === 'web') {
      console.log("Accelerometer not supported on web. Skipping sensor start.");
      return;
    }

    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(data => {
      const force = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      setLiveForce(force); 
      
      if (force > 2.5 && timeRef.current > 500) { 
        stopAttempt(); 
      }
    });
    setSubscription(sub);
  };

  const stopAccelerometer = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  const startAttempt = () => {
    setTime(0);
    setIsActive(true);
    startAccelerometer();
  };

  const stopAttempt = async () => {
    // 1. Immediately kill the timer and sensors
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopAccelerometer();

    // 2. Use the Ref to get the final time
    const finalTime = timeRef.current;

    if (finalTime > 0 && attempts.length < 3) {
      // Save to list immediately
      setAttempts(prev => [...prev, { time: finalTime, videoUri: "" }]);
      
      // Reset the clock
      setTime(0);
      timeRef.current = 0;

      // 3. Open camera
      const videoLink = await recordVideo();
      if (videoLink) {
        setAttempts(prev => {
          const updated = [...prev];
          updated[updated.length - 1].videoUri = videoLink;
          return updated;
        });
      }
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime((prev) => {
          const newTime = prev + 10;
          timeRef.current = newTime; 
          return newTime;
        });
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { 
      if (timerRef.current) clearInterval(timerRef.current); 
      stopAccelerometer(); 
    };
  }, [isActive]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const resetAll = () => {
    setIsActive(false);
    stopAccelerometer();
    setTime(0);
    setAttempts([]);
  };

  const finishAndViewResults = async () => {
    if (!attempts.length) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "Please log in to save results.");
      return;
    }

    setIsSyncing(true);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let locationData = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }

      const sanitizedAttempts = attempts.map(attempt => ({
        time: attempt.time || 0,
        videoUri: attempt.videoUri || ""
      }));

      const teamData = await getTeamData();
      
      await uploadParachuteResult(user.uid, teamData, sanitizedAttempts, locationData);

      Alert.alert("Success", "Results and Location saved!");
      router.push('/results');

    } catch (error) {
      console.error("Final Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required for video recording.');
      return null;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      return result.assets[0].uri;
    }
    return null;
  };

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Parachute Drop</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>
          Run 1–3 trials. Compare results. Improve your design.
        </Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Instructions</Text>
        <View style={[styles.bullets, { borderTopColor: border }]}>
          <Text style={[styles.bullet, { color: mutedText }]}>• Use a consistent drop height.</Text>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Start the timer as you release the toy.
          </Text>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Sensor will stop timer on impact, or tap stop manually.
          </Text>
        </View>
      </SectionCard>

      <View style={[styles.timerPanel, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.timerLabel, { color: mutedText }]}>Timer</Text>
        <Text style={[styles.timerValue, { color: text }]}>{formatTime(time)}s</Text>

        <View style={styles.sensorDataRow}>
          <Text style={[styles.helper, { color: liveForce > 2.2 ? '#FF4444' : mutedText, fontWeight: '600' }]}>
            Impact Sensor: {liveForce.toFixed(2)}g
          </Text>
          {liveForce > 2.2 && <Text style={{color: '#FF4444', fontSize: 10}}> [IMPACT DETECTED]</Text>}
        </View>

        <View style={styles.sensorDataRow}>
          <Text style={[styles.helper, { color: mutedText }]}>
            GPS Status: {locationStatus}
          </Text>
        </View>

        <View style={styles.timerButtons}>
          <PrimaryButton
            label={isActive ? 'Stop & record' : 'Start timer'}
            variant={isActive ? 'danger' : 'primary'}
            disabled={(!isActive && attempts.length >= 3) || isSyncing}
            onPress={() => {
              if (isActive) stopAttempt();
              else startAttempt();
            }}
          />
          <PrimaryButton
            label="Reset"
            variant="secondary"
            onPress={resetAll}
            disabled={(time === 0 && attempts.length === 0) || isSyncing}
          />
          <PrimaryButton
            label={isSyncing ? "Syncing..." : "Finish & Save"}
            variant="secondary"
            onPress={finishAndViewResults}
            disabled={attempts.length === 0 || isActive || isSyncing}
            style={{ borderColor: primary }}
          />
        </View>

        <View style={styles.helperRow}>
          <Text style={[styles.helper, { color: mutedText }]}>
            Attempts recorded: {attempts.length}/3
          </Text>
          <Text style={[styles.helper, { color: primary }]}>
            Best: {attempts.length ? `${formatTime(Math.min(...attempts.map(a => a.time)))}s` : '—'}  
          </Text>      
        </View>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Results</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>
            No drops recorded yet. Run a trial and tap “Stop & record”.
          </Text>
        ) : (
          <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
            {attempts.map((val, i) => (
              <AttemptRow
                key={i}
                index={i + 1}
                value={`${formatTime(val.time)}s`}
                isLast={i === attempts.length - 1}
              />
            ))}
          </View>
        )}
      </SectionCard>

      <PrimaryButton label="Back to dashboard" variant="secondary" onPress={() => router.back()} disabled={isSyncing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  header: { paddingHorizontal: Spacing.xs, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: { ...Typography.hero, fontSize: 26 },
  subtitle: { marginTop: Spacing.xs, ...Typography.body },
  sectionTitle: { ...Typography.section, marginBottom: Spacing.sm },
  bullets: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 6 },
  bullet: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  timerPanel: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg },
  timerLabel: { ...Typography.small, textTransform: 'uppercase', letterSpacing: 1.2 },
  timerValue: { marginTop: Spacing.sm, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerButtons: { marginTop: Spacing.md, gap: Spacing.sm },
  helperRow: { marginTop: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helper: { ...Typography.small },
  attemptsWrap: { borderTopWidth: 1, paddingTop: Spacing.xs },
  placeholder: { ...Typography.body, fontSize: 13, lineHeight: 19 },
  sensorDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    gap: 4,
  },
  sensorValue: {
    ...Typography.small,
    fontFamily: 'monospace', // Gives it a scientific look
    fontWeight: '600',
  },
});