import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

/**
 * BATTERY OPTIMIZATION HOOK
 * Reusable architecture utility separating resource handling from UI layers.
 * Provides a localized, single-source-of-truth position engine.
 */
export function useBatteryTracker() {
  const [isLocationFetching, setIsLocationFetching] = useState(false);

  const getOptimizedLocation = useCallback(async () => {
    setIsLocationFetching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Battery Optimization Info: Foreground permission map not granted.');
        return null;
      }

      // BATTERY OPTIMIZATION: Switched to Balanced Accuracy to capture coordinate
      // locks using cell-towers/local network hotspots instead of waking up long-range GPS hardware.
      // This rapid one-shot check resolves in milliseconds and powers down instantly.
      const locationSnapshot = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: locationSnapshot.coords.latitude,
        longitude: locationSnapshot.coords.longitude,
      };
    } catch (error) {
      console.error('Battery Optimization Hook Exception:', error);
      return null;
    } finally {
      setIsLocationFetching(false);
    }
  }, []);

  return {
    getOptimizedLocation,
    isLocationFetching,
  };
}