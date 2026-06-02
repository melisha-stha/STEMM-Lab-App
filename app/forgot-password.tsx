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
import { sendPasswordReset } from '../hooks/authService';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { overlayColor, imageOpacity } = useAuthScreenBackground();
  const text = useThemeColor({}, 'text');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter the email address for your team account.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      Alert.alert(
        'Check your email',
        'We sent a password reset link. Open it to set a new password, then come back and log in.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Reset failed', String(err));
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

        <PixelHeading>reset password</PixelHeading>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter team email"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.actions}>
          <PixelButton
            label={loading ? 'Sending...' : 'Send reset link'}
            onPress={handleSend}
            disabled={loading}
            style={styles.buttonSpacing}
          />
          <PixelButton label="Back to login" variant="secondary" onPress={() => router.back()} />
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

