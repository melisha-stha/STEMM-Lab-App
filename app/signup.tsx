import {
  AuthScreenBackground,
  authScreenSafeBackground,
  useAuthScreenBackground,
} from '@/components/ui/auth-screen-background';
import { Input } from '@/components/ui/input';
import { PixelButton } from '@/components/ui/pixel-button';
import { PixelHeading } from '@/components/ui/pixel-heading';
import { Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUp } from '../hooks/authService';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { overlayColor, imageOpacity } = useAuthScreenBackground();

  const text = useThemeColor({}, 'text');

  const handleSignUp = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please fill in all fields');
    setLoading(true);
    try {
      await signUp(email, password);
      Alert.alert('Success', 'Account created!');
      router.replace('/setup-level');
    } catch (err: any) {
      Alert.alert('Signup Failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AuthScreenBackground overlayColor={overlayColor} imageOpacity={imageOpacity} />
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>

        <PixelHeading>team signup</PixelHeading>

        <Input label="Email" value={email} onChangeText={setEmail} placeholder="team@school.com" />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Min 6 characters"
          secureTextEntry
        />

        <View style={styles.actions}>
          <PixelButton
            label={loading ? 'Creating...' : 'Sign Up'}
            onPress={handleSignUp}
            disabled={loading}
            style={styles.buttonSpacing}
          />
          <PixelButton
            label="Already have an account? Login"
            variant="secondary"
            onPress={() => router.push('/login')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authScreenSafeBackground,
  },
  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
    zIndex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: Spacing.xs,
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    zIndex: 2,
  },
  actions: {
    marginTop: Spacing.md,
    width: '100%',
  },
  buttonSpacing: {
    marginBottom: 12,
  },
});
