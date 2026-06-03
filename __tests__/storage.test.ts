import { clearTeamData, getTeamData, saveParachuteResults, saveTeamData } from '@/hooks/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Mock the core local Firebase authentication config dependency path
jest.mock('@react-native-async-storage/async-storage', () => 
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/hooks/firebaseConfig', () => ({
  auth: {
    currentUser: { uid: 'mock-user-456' }, // Simulates a logged-in teammate profile session
  },
}));

describe('Local AsyncStorage Persistence Service Test Suite (Shreeya)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // --- UNIT TEST 1 ---
  it('should successfully append new payload objects onto historical storage arrays cleanly', async () => {
    const historicalPayloads = JSON.stringify([{ time: 4.2 }]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(historicalPayloads);

    const newExperimentData = { time: 6.8 };
    await saveParachuteResults(newExperimentData);

    // Verify history array parsing structures correctly appended the new event execution trial
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@parachute_results',
      JSON.stringify([newExperimentData, { time: 4.2 }])
    );
  });

  // --- UNIT TEST 2 ---
  it('should isolate team profiles using authenticated UID string prefixes to ensure multi-account safety', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null); // No pre-existing cached team object matches

    await saveTeamData('Eco Explorers', ['Alex', 'Sam'], 'Year 8');

    // Confirm keys safely isolate account boundaries using explicit runtime UID formatting tokens
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@team_info:mock-user-456',
      expect.stringContaining('"name":"Eco Explorers"')
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@team_info_owner_uid', 'mock-user-456');
  });

  // --- UNIT TEST 3 ---
  it('should seamlessly apply a default fallback icon identifier string if the parsed asset metadata payload lacks an avatarKey entry', async () => {
    const rawSavedData = JSON.stringify({ name: 'Robo Techs', members: ['Mia'], grade: 'Year 11' });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(rawSavedData);

    const parsedTeam = await getTeamData();

    // Structural self-healing design assertion check
    expect(parsedTeam?.avatarKey).toBe('frog');
  });

  // --- INTEGRATION TEST ---
  it('should completely purge user session cache references when clear operations are explicitly fired', async () => {
    await clearTeamData();

    // Verify data isolation layer clears current accounts along with public historical traces completely
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@team_info:mock-user-456');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@team_info');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@team_info_owner_uid');
  });
});