import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Available Activities</Text>
      
      {/* Activity Card (Task A3.2) */}
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push('/parachute')}
      >
        <Text style={styles.cardTitle}>Activity 1: Parachute Drop</Text> 
        <Text>Engineering + Physics</Text> 
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  header: { fontSize: 22, fontWeight: 'bold', marginVertical: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' }
});