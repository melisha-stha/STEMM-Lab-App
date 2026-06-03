import * as Battery from 'expo-battery';
import { useEffect, useMemo, useState } from 'react';

export type DeviceBatterySnapshot = {
  available: boolean;
  levelPercent: number | null;
  batteryState: Battery.BatteryState;
  lowPowerMode: boolean;
  isCharging: boolean;
  stateLabel: string;
  healthLabel: string;
};

function formatBatteryState(state: Battery.BatteryState, isCharging: boolean): string {
  if (state === Battery.BatteryState.CHARGING) return 'Charging';
  if (state === Battery.BatteryState.FULL) return 'Full (plugged in)';
  if (state === Battery.BatteryState.UNPLUGGED) return 'On battery';
  if (isCharging) return 'Charging';
  return 'Unknown';
}

function formatHealthLabel(levelPercent: number | null, lowPowerMode: boolean): string {
  if (lowPowerMode) return 'Low power mode — conserve battery during labs';
  if (levelPercent == null || levelPercent < 0) return 'Battery level unavailable on this device';
  if (levelPercent >= 50) return 'Good for lab activities';
  if (levelPercent >= 20) return 'Consider charging before long experiments';
  return 'Low — charge before sensor-heavy activities';
}

/**
 * Live device battery level, charging state, and low-power mode for UI panels.
 */
export function useDeviceBattery(): DeviceBatterySnapshot {
  const [available, setAvailable] = useState(false);
  const { batteryLevel, batteryState, lowPowerMode } = Battery.usePowerState();

  useEffect(() => {
    void Battery.isAvailableAsync().then(setAvailable);
  }, []);

  return useMemo(() => {
    const levelPercent =
      batteryLevel >= 0 && batteryLevel <= 1 ? Math.round(batteryLevel * 100) : null;

    const isCharging =
      batteryState === Battery.BatteryState.CHARGING ||
      batteryState === Battery.BatteryState.FULL;

    return {
      available,
      levelPercent,
      batteryState,
      lowPowerMode,
      isCharging,
      stateLabel: formatBatteryState(batteryState, isCharging),
      healthLabel: formatHealthLabel(levelPercent, lowPowerMode),
    };
  }, [available, batteryLevel, batteryState, lowPowerMode]);
}
