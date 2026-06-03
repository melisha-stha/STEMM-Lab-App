import { subscribeToLeaderboard, uploadParachuteResult, uploadSoundResult } from '@/hooks/firestore';
import { addDoc, onSnapshot } from 'firebase/firestore';

// 1. Mock the entire firebase/firestore module surface
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
}));

// Mock the core local Firebase configuration context
jest.mock('@/hooks/firebaseConfig', () => ({
  db: {},
}));

describe('Cloud Firestore Database Service Test Suite (Melsa)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // --- UNIT TEST 1 ---
  it('should sanitize location values into pure numbers and capture the longest flight time on upload', async () => {
    // Simulate a successful document write returning a dummy document ID reference
    (addDoc as jest.Mock).mockResolvedValue({ id: 'parachute-doc-999' });

    const mockTeamData = { name: 'STEMM Pioneers', grade: 'Year 9', id: 42 };
    const mockAttempts = [{ time: 3.5 }, { time: 5.2 }, { time: 4.1 }];
    const rawLocation = { latitude: '-37.8136', longitude: '144.9631' }; // Simulating raw string inputs from context state

    const docId = await uploadParachuteResult('user-xyz', mockTeamData, mockAttempts, rawLocation);

    expect(docId).toBe('parachute-doc-999');
    expect(addDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        teamName: 'STEMM Pioneers',
        grade: 'Year 9',
        bestTime: 5.2, // Math.max calculation check
        location: { latitude: -37.8136, longitude: 144.9631 }, // Numeric casting check
      })
    );
  });

  // --- UNIT TEST 2 ---
  it('should fall back gracefully to fallback values when uploading incomplete result parameters', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'sound-doc-777' });

    // Send null payload properties to challenge the data validation bounds
    await uploadSoundResult('user-abc', null, [], null);

    expect(addDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        teamName: 'unknown',
        grade: '',
        peakDb: 0,
        locationData: null,
      })
    );
  });

  // --- INTEGRATION TEST ---
  it('should successfully establish live stream connections and parse document snapshot change entries', () => {
    const mockSnapshot = {
      docs: [
        {
          id: 'leader-1',
          data: () => ({ teamName: 'Alpha Team', bestTime: 12.4 }),
        },
      ],
    };

    // Simulate an instant event-driven firestore data stream snapshot return trigger
    (onSnapshot as jest.Mock).mockImplementation((_q, snapshotCallback) => {
      snapshotCallback(mockSnapshot);
      return () => 'unsubscribed';
    });

    const mockCallback = jest.fn();
    const unsubscribe = subscribeToLeaderboard(mockCallback);

    expect(mockCallback).toHaveBeenCalledWith([
      { id: 'leader-1', teamName: 'Alpha Team', bestTime: 12.4 },
    ]);
    expect(unsubscribe()).toBe('unsubscribed');
  });
});