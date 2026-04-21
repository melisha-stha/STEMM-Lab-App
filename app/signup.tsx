import { Input } from '@/components/ui/input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing, Typography } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { signUp } from '../hooks/authService';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');

  const handleSignUp = async () => {
    if (!email || !password) return Alert.alert("Error", "Please fill in all fields");
    setLoading(true);
    try {
      await signUp(email, password);
      Alert.alert("Success", "Account created!");
      router.replace('/'); // Go to dashboard
    } catch (err: any) {
      Alert.alert("Signup Failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Text style={[styles.title, { color: text }]}>Team Signup</Text>
      <Input label="Email" value={email} onChangeText={setEmail} placeholder="team@school.com" />
      <Input label="Password" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry />
      <View style={{ marginTop: Spacing.md }}>
        <PrimaryButton label={loading ? "Creating..." : "Sign Up"} onPress={handleSignUp} disabled={loading} />
        <PrimaryButton label="Already have an account? Login" variant="secondary" onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.md },
  title: { ...Typography.hero, textAlign: 'center', marginBottom: Spacing.lg }
});