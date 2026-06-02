import {
  AuthScreenBackground,
  authScreenSafeBackground,
  useAuthScreenBackground,
} from '@/components/ui/auth-screen-background';
import { Input } from '@/components/ui/input';
import { PixelButton } from '@/components/ui/pixel-button';
import { PixelHeading } from '@/components/ui/pixel-heading';
import { Spacing } from '@/constants/design';
import { resolvePostLoginRoute } from '@/hooks/app-routing';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../hooks/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { overlayColor, imageOpacity } = useAuthScreenBackground();

  const text = useThemeColor({}, 'text');
  const mutedText = useThemeColor({}, 'mutedText');

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(email, password);
      const destination = await resolvePostLoginRoute();
      router.replace(destination);
    } catch (err: any) {
      Alert.alert('Login Failed', err);
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

        <PixelHeading>team login</PixelHeading>

        <Input label="Email" value={email} onChangeText={setEmail} placeholder="Enter team email" />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          showPasswordToggle
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/forgot-password')}
          style={styles.forgotLink}>
          <Text style={[styles.forgotText, { color: mutedText }]}>Forgot password?</Text>
        </Pressable>

        <View style={styles.actions}>
          <PixelButton
            label={loading ? 'Logging in...' : 'Login'}
            onPress={handleLogin}
            disabled={loading}
            style={styles.buttonSpacing}
          />
          <PixelButton
            label="New team? Sign Up"
            variant="secondary"
            onPress={() => router.push('/signup')}
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
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  buttonSpacing: {
    marginBottom: 12,
  },
});
