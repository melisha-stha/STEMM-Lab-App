import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { hasTeamSaved } from '@/hooks/app-routing';
import { login } from '../hooks/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(email, password);
      const hasTeam = await hasTeamSaved();
      router.replace(hasTeam ? '/(tabs)' : '/setup-level');
    } catch (err: any) {
      Alert.alert("Login Failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={text} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: text }]}>Team Login</Text>
      <Input label="Email" value={email} onChangeText={setEmail} placeholder="Enter team email" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <View style={{ marginTop: Spacing.md }}>
        <PrimaryButton label={loading ? "Logging in..." : "Login"} onPress={handleLogin} disabled={loading} />
        <PrimaryButton label="New team? Sign Up" variant="secondary" onPress={() => router.push('/signup')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.md },
  backButton: { alignSelf: 'flex-start', padding: Spacing.xs, position: 'absolute', top: Spacing.lg, left: Spacing.lg },
  title: { ...Typography.hero, textAlign: 'center', marginBottom: Spacing.lg }
});