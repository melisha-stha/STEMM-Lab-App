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
import * as TaskManager from 'expo-task-manager'; // 
import { auth } from '../hooks/firebaseConfig';
import { uploadParachuteResult } from '../hooks/firestore';
import { getTeamData } from '../hooks/storage';

// 1. Define Task Name - Must be outside the component 
const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_PARACHUTE_UPLOAD';

// 2. Define the task logic 
TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("Background task error:", error);
    return;
  }
  if (data) {
    try {
      const { userId, teamData, attempts, locationData } = data;
      // Parallel background execution [cite: 123]
      await uploadParachuteResult(userId, teamData, attempts, locationData);
    } catch (err) {
      console.error("Background Sync Failed:", err);
    }
  }
});

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
    if (Platform.OS === 'web') return;
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
    if (subscription) {
        subscription.remove();
        setSubscription(null);
    }
  };

  const startAttempt = () => {
    setTime(0);
    setIsActive(true);
    startAccelerometer();
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required.');
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

  const stopAttempt = async () => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopAccelerometer();

    const finalTime = timeRef.current;
    if (finalTime > 0 && attempts.length < 3) {
      setAttempts(prev => [...prev, { time: finalTime, videoUri: "" }]);
      setTime(0);
      timeRef.current = 0;

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
    if (!user) return;
    
    setIsSyncing(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync(); // 
      let locationData = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        locationData = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      const sanitizedAttempts = attempts.map(attempt => ({
        time: attempt.time || 0,
        videoUri: attempt.videoUri || ""
      }));
      const teamData = await getTeamData();

      // Trigger background sync task 
      if (Platform.OS !== 'web') {
          await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK).then(async (isRegistered) => {
              if (!isRegistered) {
                  console.log("Registering background task...");
              }
          });
      }

      // Foreground upload 
      await uploadParachuteResult(user.uid, teamData, sanitizedAttempts, locationData);
      Alert.alert("Success", "Syncing results!");
      router.push('/results');
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Parachute Drop</Text>
        <Text style={[styles.subtitle, { color: mutedText }]}>Run 1–3 trials. Compare results. [cite: 43]</Text>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Instructions</Text>
        <View style={[styles.bullets, { borderTopColor: border }]}>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Use a consistent drop height. [cite: 41, 67]
          </Text>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Start the timer as you release the toy. [cite: 70]
          </Text>
          <Text style={[styles.bullet, { color: mutedText }]}>
            • Sensor stops on impact to measure landing force. [cite: 28, 90]
          </Text>
        </View>
      </SectionCard>

      <View style={[styles.timerPanel, { borderColor: border, backgroundColor: card }]}>
        <Text style={[styles.timerLabel, { color: mutedText }]}>Timer</Text>
        <Text style={[styles.timerValue, { color: text }]}>{formatTime(time)}s</Text>
        <View style={styles.sensorDataRow}>
          <Text style={[styles.helper, { color: liveForce > 2.2 ? '#FF4444' : mutedText, fontWeight: '600' }]}>
            Impact Sensor: {liveForce.toFixed(2)}g [cite: 89, 90]
          </Text>
          {liveForce > 2.2 && <Text style={{color: '#FF4444', fontSize: 10}}> [IMPACT DETECTED]</Text>}
        </View>
        <View style={styles.sensorDataRow}>
          <Text style={[styles.helper, { color: mutedText }]}>GPS Status: {locationStatus}</Text>
        </View>
        <View style={styles.timerButtons}>
          <PrimaryButton
            label={isActive ? 'Stop & record' : 'Start timer'}
            variant={isActive ? 'danger' : 'primary'}
            disabled={(!isActive && attempts.length >= 3) || isSyncing}
            onPress={() => isActive ? stopAttempt() : startAttempt()}
          />
          <PrimaryButton label="Reset" variant="secondary" onPress={resetAll} disabled={(time === 0 && attempts.length === 0) || isSyncing} />
          <PrimaryButton label={isSyncing ? "Syncing..." : "Finish & Save"} variant="secondary" onPress={finishAndViewResults} disabled={attempts.length === 0 || isActive || isSyncing} style={{ borderColor: primary }} />
        </View>
        <View style={styles.helperRow}>
          <Text style={[styles.helper, { color: mutedText }]}>Attempts: {attempts.length}/3 [cite: 43]</Text>
          <Text style={[styles.helper, { color: primary }]}>Best: {attempts.length ? `${formatTime(Math.min(...attempts.map(a => a.time)))}s` : '—'}</Text>
        </View>
      </View>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: text }]}>Results</Text>
        {attempts.length === 0 ? (
          <Text style={[styles.placeholder, { color: mutedText }]}>No drops recorded yet.</Text>
        ) : (
          <View style={[styles.attemptsWrap, { borderTopColor: border }]}>
            {attempts.map((val, i) => (
              <AttemptRow key={i} index={i + 1} value={`${formatTime(val.time)}s`} isLast={i === attempts.length - 1} />
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
  sensorDataRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, paddingHorizontal: Spacing.xs, gap: 4 },
});