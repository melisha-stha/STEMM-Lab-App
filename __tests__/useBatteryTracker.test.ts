import { useBatteryTracker } from '@/hooks/useBatteryTracker';
import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';

// 1. Mock the native Expo Location module
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: {
    Balanced: 3, // Simulates the internal Expo enum value for Balanced accuracy
  },
}));

describe('Battery Tracker Hook Test Suite (Melsa)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- UNIT TEST 1 ---
  it('should return null and log a message if location permissions are denied', async () => {
    // Simulate the user clicking "Deny"
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    const { result } = renderHook(() => useBatteryTracker());

    let location = null;
    await act(async () => {
      location = await result.current.getOptimizedLocation();
    });

    expect(location).toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(result.current.isLocationFetching).toBe(false);
  });

  // --- UNIT TEST 2 ---
  it('should handle errors gracefully and return null if fetching coordinates throws an exception', async () => {
    // Simulate permission allowed, but the GPS hardware fails/throws an error
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
      new Error('Hardware timeout')
    );

    const { result } = renderHook(() => useBatteryTracker());

    let location = null;
    await act(async () => {
      location = await result.current.getOptimizedLocation();
    });

    expect(location).toBeNull();
    expect(result.current.isLocationFetching).toBe(false);
  });

  // --- INTEGRATION TEST ---
  it('should successfully manage loading states and return coordinates using Balanced accuracy when permission is granted', async () => {
    // Simulate successful permission and fake coordinates back from the device hardware
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: -37.8136,
        longitude: 144.9631,
      },
    });

    const { result } = renderHook(() => useBatteryTracker());

    let location: any = null;
    await act(async () => {
      location = await result.current.getOptimizedLocation();
    });

    // Check that it returned our coordinates correctly
    expect(location).toEqual({
      latitude: -37.8136,
      longitude: 144.9631,
    });

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
    
    expect(result.current.isLocationFetching).toBe(false);
  });
});