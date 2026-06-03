import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NotificationContent = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryIdentifier?: string;
};

const GOOGLE_TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

let handlerConfigured = false;

/** Remote/push notifications are unavailable in Expo Go on Android (SDK 53+). */
export function areAppNotificationsAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    return false;
  }
  return true;
}

function getNotificationsModule(): typeof import('expo-notifications') | null {
  if (!areAppNotificationsAvailable()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

export function configureNotificationHandler(): void {
  if (handlerConfigured) return;

  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!areAppNotificationsAvailable()) {
    if (__DEV__) {
      console.log('[Notifications]: Unavailable in this runtime (Expo Go Android or web).');
    }
    return false;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (__DEV__) {
    console.log(`[Notifications]: Permission status is "${existingStatus}".`);
  }

  if (existingStatus === 'granted') return true;
  if (existingStatus === 'denied') return false;

  const { status } = await Notifications.requestPermissionsAsync();
  if (__DEV__) {
    console.log(`[Notifications]: Permission request result is "${status}".`);
  }

  return status === 'granted';
}

export async function setupNotificationCategories(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationCategoryAsync('timer-warning', [
    { identifier: 'OK_ACTION', buttonTitle: 'Okay', options: { opensAppToForeground: false } },
  ]);

  await Notifications.setNotificationCategoryAsync('mission-reminder', [
    { identifier: 'GO_ACTION', buttonTitle: 'Go', options: { opensAppToForeground: true } },
  ]);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
}

export async function scheduleAppNotification(content: NotificationContent): Promise<void> {
  if (!areAppNotificationsAvailable()) {
    if (__DEV__) console.log('[Notifications]: Schedule skipped (unavailable runtime).');
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    if (__DEV__) console.log('[Notifications]: Schedule skipped (permission not granted).');
    return;
  }

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    const notificationContent: Record<string, unknown> = {
      title: content.title,
      body: content.body,
    };
    if (content.data) notificationContent.data = content.data;
    if (content.categoryIdentifier) {
      notificationContent.categoryIdentifier = content.categoryIdentifier;
    }

    await Notifications.scheduleNotificationAsync({
      content: notificationContent as import('expo-notifications').NotificationContentInput,
      trigger: null,
    });
  } catch (error) {
    if (__DEV__) console.warn('[Notifications]: Failed to schedule notification.', error);
  }
}

export async function triggerMissionWelcome(activeMissionName: string): Promise<void> {
  const routeSlug = `/${activeMissionName.toLowerCase().replace(/\s+/g, '')}`;

  if (__DEV__) {
    console.log(`[Notifications]: Mission welcome for "${activeMissionName}".`);
  }

  await scheduleAppNotification({
    title: 'Today lab mission is active',
    body: `Try to complete the ${activeMissionName} challenge with your team today!`,
    categoryIdentifier: 'mission-reminder',
    data: { route: routeSlug },
  });
}

export function getAdMobBannerUnitId(testBannerId?: string | null): string {
  const envUnitId = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim();
  if (envUnitId) return envUnitId;
  return testBannerId || GOOGLE_TEST_BANNER_UNIT_ID;
}
