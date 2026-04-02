import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getTeamData } from '../../hooks/storage';

interface TeamData {
  name: string;
  id: number;
  members: string[];
  grade: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  useEffect(() => {
    const loadTeam = async () => {
      const data = await getTeamData();
      setTeam(data);
    };
    loadTeam();
  }, []);

  return (
    <View style={styles.container}>
      {/* Team Header Section */}
      <Text style={styles.title}>Welcome, {team?.name || 'Team'}!</Text>      
      <Text style={styles.idText}>Team ID: {team?.id || '----'}</Text> 

      <Text style={styles.sectionHeader}>Available Activities</Text> 
      
      {/* Activity Card 1: Parachute Drop */}
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push('/parachute')}
      >
        <Text style={styles.cardTitle}>Activity 1: Parachute Drop</Text> 
        <Text style={styles.cardSubtitle}>Engineering + Physics</Text> 
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#007AFF' },
  idText: { fontSize: 14, color: '#666', marginBottom: 20 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  cardSubtitle: { fontSize: 14, color: '#666', marginTop: 4 }
});