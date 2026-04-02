import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ParachuteScreen() {
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Parachute Drop Challenge</Text> 
      
      <View style={styles.instructionBox}>
        <Text style={styles.subtitle}>Instructions:</Text>
        <Text>1. Drop toy without parachute (Baseline).</Text> 
        <Text>2. Build and test your design.</Text> 
        <Text>3. Record the fall time.</Text> 
      </View>

      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>00:00.00</Text>
        <Button 
          title={isActive ? "Stop Timer" : "Start Timer"} 
          onPress={() => setIsActive(!isActive)} 
          color={isActive ? "red" : "green"}
        />
      </View>

      <Button title="Go Back" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  instructionBox: { padding: 15, backgroundColor: '#eee', borderRadius: 8, marginBottom: 20 },
  timerContainer: { alignItems: 'center', marginVertical: 30 },
  timerText: { fontSize: 48, fontFamily: 'monospace', marginBottom: 10 }
});