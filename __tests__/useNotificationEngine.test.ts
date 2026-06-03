import { useNotificationEngine } from '@/hooks/useNotificationEngine';
import { renderHook } from '@testing-library/react-native';

// 1. Mock the external notification helpers
const mockAreAppNotificationsAvailable = jest.fn();
const mockEnsureNotificationPermissions = jest.fn();
const mockConfigureNotificationHandler = jest.fn();
const mockSetupNotificationCategories = jest.fn();

jest.mock('@/hooks/notifications', () => ({
  areAppNotificationsAvailable: () => mockAreAppNotificationsAvailable(),
  ensureNotificationPermissions: () =>
    mockEnsureNotificationPermissions(),
  configureNotificationHandler: () =>
    mockConfigureNotificationHandler(),
  setupNotificationCategories: () =>
    mockSetupNotificationCategories(),
  triggerMissionWelcome: jest.fn(),
}));

// 2. Mock Expo Router navigation
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// 3. Mock Expo Notifications listeners
const mockAddNotificationReceivedListener = jest.fn((_cb: any) => ({  // <-- updated
  remove: jest.fn(),
}));

const mockAddNotificationResponseReceivedListener = jest.fn((_cb: any) => ({  // <-- updated
  remove: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: (cb: any) => {
    return mockAddNotificationReceivedListener(cb);
  },
  addNotificationResponseReceivedListener: (cb: any) => {
    return mockAddNotificationResponseReceivedListener(cb);
  },
}));

describe('Notification Engine Test Suite (Melsa)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAreAppNotificationsAvailable.mockReturnValue(true);

    mockEnsureNotificationPermissions.mockResolvedValue(true);
  });

  // --- UNIT TEST 1 ---
  it('should immediately stop initialization if notifications are unavailable', async () => {
    mockAreAppNotificationsAvailable.mockReturnValue(false);

    renderHook(() => useNotificationEngine());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      mockConfigureNotificationHandler
    ).not.toHaveBeenCalled();

    expect(
      mockSetupNotificationCategories
    ).not.toHaveBeenCalled();
  });

  // --- UNIT TEST 2 ---
  it('should halt setup if notification permission is denied', async () => {
    mockEnsureNotificationPermissions.mockResolvedValue(false);

    renderHook(() => useNotificationEngine());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      mockConfigureNotificationHandler
    ).toHaveBeenCalled();

    expect(
      mockSetupNotificationCategories
    ).not.toHaveBeenCalled();
  });

  // --- INTEGRATION TEST ---
  it('should register notification listeners during initialization', () => {
    renderHook(() => useNotificationEngine());

    expect(
      mockAddNotificationReceivedListener
    ).toHaveBeenCalled();

    expect(
      mockAddNotificationResponseReceivedListener
    ).toHaveBeenCalled();
  });
});