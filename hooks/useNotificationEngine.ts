import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotificationEngine() {
  const router = useRouter();

  useEffect(() => {
    async function configureNotifications() {
      console.log('[Debug]: Notification engine initializing...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log(`[Debug]: Current permission status is: ${existingStatus}`);
      
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        console.log('Asking device for permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Debug]: Permissions denied or blocked by system.');
        return;
      }
      
      console.log('[Debug]: Permissions are GRANTED. Setting up categories...');

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
      console.log('[Debug]: Notification categories configured perfectly!');
    }

    configureNotifications();
  }, []);

  useEffect(() => {
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[SUCCESS]: Local notification received in foreground!');
      console.log(`Title: ${notification.request.content.title}`);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const routeTarget = response.notification.request.content.data?.route;
      if (response.actionIdentifier === 'GO_ACTION' && routeTarget) {
        router.push(routeTarget as any);
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);
}

export async function triggerMissionWelcome(activeMissionName: string) {
  const routeslug = `/${activeMissionName.toLowerCase().replace(/\s+/g, '')}`;
  console.log(`[Debug]: Attempting to dispatch notification for ${activeMissionName}...`);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Today lab mission is active',
      body: `Try to complete the ${activeMissionName} challenge with your team today!`,
      categoryIdentifier: 'mission-reminder',
      data: { route: routeslug },
    },
    trigger: null,
  });
  console.log('[Debug]: scheduleNotificationAsync command successfully executed.');
}