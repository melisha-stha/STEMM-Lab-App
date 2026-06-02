import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Remote/push notifications are unavailable in Expo Go on Android (SDK 53+). */
export function areAppNotificationsAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    return false;
  }
  return true;
}

export function configureNotificationHandler(): void {
  if (!areAppNotificationsAvailable()) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

type NotificationContent = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function scheduleAppNotification(content: NotificationContent): Promise<void> {
  if (!areAppNotificationsAvailable()) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
  } catch (error) {
    console.warn('Failed to schedule notification:', error);
  }
}
