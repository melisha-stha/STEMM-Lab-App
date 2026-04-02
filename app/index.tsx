import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [member1, setMember1] = useState('');
  const [grade, setGrade] = useState('');

  const handleCreateTeam = () => {
    // Basic Validation 
    if (!teamName || !member1 || !grade) {
      Alert.alert("Error", "Please fill in Team Name, at least one Member, and Grade.");
      return;
    }
    // this is where we'll call Firebase/AsyncStorage logic
    console.log("Team Created:", { teamName, member1, grade });
    
    // Navigate to the Tabs/Home (Task A2.4)
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>STEMM Lab Setup</Text> 
      
      <TextInput 
        style={styles.input} 
        placeholder="Team Name" 
        onChangeText={setTeamName} 
      />

      <TextInput 
        style={styles.input} 
        placeholder="First Name (Member 1)" 
        onChangeText={setMember1} 
      />

      <TextInput 
        style={styles.input} 
        placeholder="Grade / Year Level" 
        keyboardType="numeric"
        onChangeText={setGrade} 
      />

      <TouchableOpacity style={styles.button} onPress={handleCreateTeam}>
        <Text style={styles.buttonText}>Create Team</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});