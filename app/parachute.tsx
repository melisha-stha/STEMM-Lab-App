import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ParachuteScreen() {
  const router = useRouter();
  
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(0); 
  const [attempts, setAttempts] = useState<number[]>([]); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to record the current time (Task B3.2)
  const recordAttempt = () => {
    if (time > 0 && attempts.length < 3) {
      setAttempts([...attempts, time]);
    }
  };

  // Timer "Engine" 
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 10);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive]);

  // Format milliseconds to 00.00 
  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  // Clear all data 
  const resetAll = () => {
    setIsActive(false);
    setTime(0);
    setAttempts([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Parachute Drop Challenge</Text> 
      
      <View style={styles.instructionBox}>
        <Text style={styles.subtitle}>Instructions:</Text>
        <Text>1. Drop the toy from a set height.</Text>
        <Text>2. Stop the timer when it hits the ground.</Text>
        <Text>3. Record up to 3 attempts to compare results.</Text> 
      </View>

      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(time)}s</Text>
        
        <View style={styles.buttonRow}>
          <Button 
            title={isActive ? "Stop & Record" : "Start Timer"} 
            onPress={() => {
              if (isActive) {
                recordAttempt(); 
              }
              setIsActive(!isActive);
            }} 
            color={isActive ? "#FF3B30" : "#4CD964"}
          />
        </View>
        
        <TouchableOpacity onPress={resetAll} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset All Attempts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsBox}>
        <Text style={styles.subtitle}>Recent Attempts:</Text>
        {attempts.length === 0 ? (
          <Text style={styles.placeholder}>No drops recorded yet.</Text>
        ) : (
          attempts.map((val, i) => (
            <View key={i} style={styles.resultItem}>
              <Text style={styles.resultText}>Attempt {i + 1}:</Text>
              <Text style={styles.resultValue}>{formatTime(val)}s</Text>
            </View>
          ))
        )}
      </View>

      <Button title="Back to Dashboard" onPress={() => router.back()} />
      <View style={{ height: 40 }} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 15, color: '#1C1C1E' },
  subtitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, color: '#3A3A3C' },
  instructionBox: { padding: 15, backgroundColor: '#F2F2F7', borderRadius: 12, marginBottom: 25 },
  timerContainer: { 
    alignItems: 'center', 
    marginVertical: 20, 
    padding: 30, 
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timerText: { fontSize: 64, fontWeight: '700', marginBottom: 25, fontFamily: 'monospace', color: '#1C1C1E' },
  buttonRow: { width: '100%', marginBottom: 10 },
  resetButton: { marginTop: 10, padding: 10 },
  resetText: { color: '#007AFF', fontWeight: '600' },
  resultsBox: { marginBottom: 40, padding: 15, backgroundColor: '#F2F2F7', borderRadius: 12 },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#D1D1D6' },
  resultText: { fontSize: 18, color: '#3A3A3C' },
  resultValue: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  placeholder: { color: '#8E8E93', fontStyle: 'italic' }
});