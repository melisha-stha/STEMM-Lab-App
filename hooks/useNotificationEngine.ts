import {
  areAppNotificationsAvailable,
  configureNotificationHandler,
  ensureNotificationPermissions,
  setupNotificationCategories,
} from '@/hooks/notifications';
import * as Notifications from 'expo-notifications'; // add this
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

export { triggerMissionWelcome } from '@/hooks/notifications';

export function useNotificationEngine() {
  const router = useRouter();
  const setupStarted = useRef(false);

  useEffect(() => {
    if (setupStarted.current) return;
    setupStarted.current = true;

    async function initializeEngine() {
      if (!areAppNotificationsAvailable()) {
        if (__DEV__) {
          console.log('[Notifications]: Engine skipped for this runtime.');
        }
        return;
      }

      if (__DEV__) console.log('[Notifications]: Engine initializing...');

      configureNotificationHandler();

      const granted = await ensureNotificationPermissions();
      if (!granted) {
        if (__DEV__) console.log('[Notifications]: Engine setup paused (no permission).');
        return;
      }

      await setupNotificationCategories();

      if (__DEV__) console.log('[Notifications]: Engine ready.');
    }

    void initializeEngine();
  }, []);

  useEffect(() => {
    if (!areAppNotificationsAvailable()) return;

    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        console.log('[Notifications]: Received in foreground:', notification.request.content.title);
      }
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